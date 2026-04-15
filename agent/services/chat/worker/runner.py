"""ChatStreamWorker — processes one LangGraph streaming run and emits SSE events."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Mapping

from langchain_core.messages import HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph.state import CompiledStateGraph

from config import MODEL_CONTEXT_WINDOWS
from schemas.chat import ChatAttachmentPayload, ChatSseEventPayload, JsonObject, JsonValue

from ..run_manager import unregister_run
from ..utils import (
    content_to_text,
    normalize_tool_args,
    normalize_tool_result,
    persist_partial_assistant_message,
    sse,
)
from ._constants import FRONTEND_TOOL_NAMES, STREAMABLE_TOOL_NAMES
from ._message_state import AssistantMessageState
from ._tool_state import ToolCallState

logger = logging.getLogger(__name__)


def _event_data(event: Mapping[str, object]) -> dict[str, object]:
    data = event.get("data")
    return data if isinstance(data, dict) else {}


def _event_name(event: Mapping[str, object]) -> str:
    name = event.get("name")
    return name if isinstance(name, str) and name else "unknown_tool"


def _event_tool_call_id(event: Mapping[str, object]) -> str:
    payload = _event_data(event)
    tool_call_id = payload.get("tool_call_id")
    return tool_call_id if isinstance(tool_call_id, str) and tool_call_id else ""


def _normalize_chunk_message_id(chunk: object) -> str | None:
    chunk_msg_id = getattr(chunk, "id", None)
    if isinstance(chunk_msg_id, str):
        normalized = chunk_msg_id.strip()
        if normalized:
            return normalized
    return None


def _normalize_tool_input(raw_input: object) -> JsonObject:
    tool_input = raw_input.get("input", raw_input) if isinstance(raw_input, dict) else raw_input
    if isinstance(tool_input, str):
        try:
            decoded = json.loads(tool_input)
        except Exception:
            return normalize_tool_args(tool_input)
        return normalize_tool_args(decoded)
    return normalize_tool_args(tool_input)


class ChatStreamWorker:
    """Encapsulates the SSE worker logic for a single chat run."""

    def __init__(
        self,
        *,
        compiled_graph: CompiledStateGraph,
        thread_id: str,
        run_id: str,
        queue: asyncio.Queue[str | None],
        stop_event: asyncio.Event,
        message: str,
        tool_call_id: str,
        tool_result: JsonValue | None,
        selected_model: str | None = None,
        attachments: list[ChatAttachmentPayload] | None = None,
        knowledge_source_ids: list[int] | None = None,
    ) -> None:
        self._graph = compiled_graph
        self._thread_id = thread_id
        self._run_id = run_id
        self._queue = queue
        self._stop_event = stop_event
        self._message = message
        self._tool_call_id = tool_call_id
        self._tool_result = tool_result
        self._attachments = attachments or []
        self._messages = AssistantMessageState()
        self._tools = ToolCallState()
        self._run_completed = False
        self._total_input_tokens = 0
        self._total_output_tokens = 0
        self._context_window = MODEL_CONTEXT_WINDOWS.get(selected_model or "", 0)

        self._config: RunnableConfig = {
            "configurable": {
                "thread_id": thread_id,
                "selected_model": selected_model,
                "current_attachments": self._attachments,
                "knowledge_source_ids": knowledge_source_ids or [],
            },
            "recursion_limit": 100,
        }

    async def run(self) -> None:
        """Execute the streaming run; all SSE frames are pushed to *self._queue*."""
        try:
            await self._emit({
                "type": "RUN_STARTED",
                "runId": self._run_id,
                "threadId": self._thread_id,
            })

            async for event in self._graph.astream_events(
                self._build_input_payload(),
                config=self._config,
                version="v2",
            ):
                if self._stop_event.is_set():
                    raise asyncio.CancelledError()
                await self._dispatch_event(event)

            self._run_completed = True
            await self._close_open_text_message()
            await self._emit_run_finished()
        except asyncio.CancelledError:
            await self._persist_partial_message_if_needed()
            await self._close_open_text_message()
            await self._emit_run_finished()
        except Exception:
            logger.exception(
                "Chat run worker failed: thread=%s run=%s",
                self._thread_id,
                self._run_id,
            )
            await self._close_open_text_message()
            await self._emit({
                "type": "RUN_ERROR",
                "runId": self._run_id,
                "threadId": self._thread_id,
                "message": "An internal error occurred. Please try again.",
            })
            await self._queue.put("data: [DONE]\n\n")
        finally:
            await self._queue.put(None)
            await unregister_run(self._thread_id, self._run_id)

    def _build_input_payload(self) -> dict[str, list[HumanMessage | ToolMessage]]:
        if self._message:
            message_kwargs = {"attachments": self._attachments} if self._attachments else {}
            return {"messages": [HumanMessage(content=self._message, additional_kwargs=message_kwargs)]}

        return {
            "messages": [
                ToolMessage(
                    tool_call_id=self._tool_call_id,
                    content=json.dumps(self._tool_result, ensure_ascii=False),
                )
            ]
        }

    async def _dispatch_event(self, event: Mapping[str, object]) -> None:
        kind = event.get("event", "")

        if kind == "on_chat_model_start":
            self._tools.reset_model_stream()
            return
        if kind == "on_chat_model_stream":
            await self._handle_chat_model_stream(event)
            return
        if kind == "on_chat_model_end":
            await self._handle_chat_model_end(event)
            return
        if kind == "on_tool_start":
            await self._handle_tool_start(event)
            return
        if kind == "on_tool_end":
            await self._handle_tool_end(event)
            return
        if kind == "on_tool_error":
            await self._handle_tool_error(event)

    async def _handle_chat_model_stream(self, event: Mapping[str, object]) -> None:
        payload = _event_data(event)
        chunk = payload.get("chunk")
        if chunk is None:
            return

        chunk_message_id = _normalize_chunk_message_id(chunk)
        additional_kwargs = getattr(chunk, "additional_kwargs", {}) or {}
        reasoning_delta = additional_kwargs.get("reasoning_content", "")
        if reasoning_delta:
            message_id = await self._ensure_open_text_message(chunk_message_id)
            if not self._messages.reasoning_started:
                self._messages.reasoning_started = True
                await self._emit({
                    "type": "REASONING_START",
                    "messageId": message_id,
                })

            self._messages.reasoning_parts.append(reasoning_delta)
            await self._emit({
                "type": "REASONING_CONTENT",
                "messageId": message_id,
                "delta": reasoning_delta,
            })

        delta = content_to_text(getattr(chunk, "content", ""))
        if delta:
            if self._messages.reasoning_started:
                self._messages.reasoning_started = False
                if self._messages.open_ui_message_id:
                    await self._emit({
                        "type": "REASONING_END",
                        "messageId": self._messages.open_ui_message_id,
                    })

            message_id = await self._ensure_open_text_message(chunk_message_id)
            self._messages.open_message_parts.append(delta)
            await self._emit({
                "type": "TEXT_MESSAGE_CONTENT",
                "messageId": message_id,
                "role": "assistant",
                "delta": delta,
            })

        tool_call_chunks = getattr(chunk, "tool_call_chunks", None) or []
        if tool_call_chunks and self._messages.open_ui_message_id:
            await self._close_open_text_message()

        for tool_call_chunk in tool_call_chunks:
            if not isinstance(tool_call_chunk, dict):
                continue
            index = tool_call_chunk.get("index", 0)
            if not isinstance(index, int):
                continue

            self._tools.remember_chunk_name(index, tool_call_chunk.get("name"))
            chunk_id = self._tools.resolve_chunk_id(
                index=index,
                raw_id=tool_call_chunk.get("id"),
            )

            tool_name = self._tools.get_chunk_name(index)
            args_delta = tool_call_chunk.get("args", "")
            if (
                not tool_name
                or not chunk_id
                or not isinstance(args_delta, str)
                or not args_delta
                or tool_name not in STREAMABLE_TOOL_NAMES
            ):
                continue

            await self._emit({
                "type": "TOOL_CALL_ARGS_DELTA",
                "toolCallId": chunk_id,
                "toolName": tool_name,
                "argsDelta": args_delta,
            })

    async def _handle_chat_model_end(self, event: Mapping[str, object]) -> None:
        if self._messages.reasoning_started:
            self._messages.reasoning_started = False
            if self._messages.open_ui_message_id:
                await self._emit({
                    "type": "REASONING_END",
                    "messageId": self._messages.open_ui_message_id,
                })

        self._tools.reset_model_stream()

        payload = _event_data(event)
        output = payload.get("output")
        if output is None:
            return

        tool_calls = getattr(output, "tool_calls", None) or []
        for tool_call in tool_calls:
            if not isinstance(tool_call, dict):
                continue

            tool_name = tool_call.get("name", "")
            if tool_name not in FRONTEND_TOOL_NAMES:
                continue

            tool_call_id = tool_call.get("id", "")
            if not tool_call_id:
                continue

            message_id = self._messages.open_ui_message_id or self._messages.to_ui_message_id(
                run_id=self._run_id,
                raw_id=getattr(output, "id", None),
            )

            if self._messages.open_ui_message_id:
                await self._close_open_text_message()

            await self._emit({
                "type": "TOOL_CALL_START",
                "messageId": message_id,
                "toolCallId": tool_call_id,
                "toolName": tool_name,
                "args": normalize_tool_args(tool_call.get("args")),
            })

        # Extract token usage from AIMessage.usage_metadata
        # Only keep the latest call's usage (not cumulative), because each
        # LLM call already includes the full conversation history as input.
        # In a tool-loop run the last call reflects the true context size.
        usage = getattr(output, "usage_metadata", None)
        if isinstance(usage, dict):
            self._total_input_tokens = usage.get("input_tokens", 0)
            self._total_output_tokens = usage.get("output_tokens", 0)

    async def _handle_tool_start(self, event: Mapping[str, object]) -> None:
        if self._messages.open_ui_message_id:
            await self._close_open_text_message()

        tool_call_id = _event_tool_call_id(event)
        if not tool_call_id:
            return

        tool_name = _event_name(event)
        payload = _event_data(event)
        tool_args = _normalize_tool_input(payload.get("input", {}))
        message_id = self._messages.open_ui_message_id or self._messages.to_ui_message_id(
            run_id=self._run_id,
            raw_id=None,
        )

        await self._emit({
            "type": "TOOL_CALL_START",
            "messageId": message_id,
            "toolCallId": tool_call_id,
            "toolName": tool_name,
            "args": tool_args,
        })

    async def _handle_tool_end(self, event: Mapping[str, object]) -> None:
        tool_call_id = _event_tool_call_id(event)
        if not tool_call_id:
            return

        tool_name = _event_name(event)
        payload = _event_data(event)
        raw_output = payload.get("output")
        if hasattr(raw_output, "content"):
            result = normalize_tool_result(raw_output.content)
        else:
            result = normalize_tool_result(raw_output)

        message_id = self._messages.to_ui_message_id(run_id=self._run_id, raw_id=None)

        await self._emit({
            "type": "TOOL_CALL_END",
            "messageId": message_id,
            "toolCallId": tool_call_id,
            "toolName": tool_name,
            "args": _normalize_tool_input(payload.get("input", {})),
            "result": result,
        })

    async def _handle_tool_error(self, event: Mapping[str, object]) -> None:
        tool_call_id = _event_tool_call_id(event)
        if not tool_call_id:
            return

        tool_name = _event_name(event)
        payload = _event_data(event)
        error = payload.get("error")

        message_id = self._messages.to_ui_message_id(run_id=self._run_id, raw_id=None)

        await self._emit({
            "type": "TOOL_CALL_END",
            "messageId": message_id,
            "toolCallId": tool_call_id,
            "toolName": tool_name,
            "args": _normalize_tool_input(payload.get("input", {})),
            "result": {"error": str(error) if error else "Tool execution failed"},
        })

    async def _ensure_open_text_message(self, raw_id: object) -> str:
        message_id, started = self._messages.ensure_open_message(
            run_id=self._run_id,
            raw_id=raw_id,
        )
        if started:
            await self._emit({
                "type": "TEXT_MESSAGE_START",
                "messageId": message_id,
                "role": "assistant",
            })
        return message_id

    async def _close_open_text_message(self) -> None:
        if self._messages.reasoning_started and self._messages.open_ui_message_id:
            self._messages.reasoning_started = False
            await self._emit({
                "type": "REASONING_END",
                "messageId": self._messages.open_ui_message_id,
            })

        if self._messages.open_ui_message_id:
            await self._emit({
                "type": "TEXT_MESSAGE_END",
                "messageId": self._messages.open_ui_message_id,
            })

        self._messages.reset_open_message()

    async def _persist_partial_message_if_needed(self) -> None:
        if self._run_completed or not self._messages.open_ui_message_id:
            return

        await persist_partial_assistant_message(
            compiled_graph=self._graph,
            config=self._config,
            message_id=self._messages.open_ui_message_id,
            content=self._messages.current_content(),
        )

    async def _emit_run_finished(self) -> None:
        payload: ChatSseEventPayload = {
            "type": "RUN_FINISHED",
            "runId": self._run_id,
            "threadId": self._thread_id,
        }
        total = self._total_input_tokens + self._total_output_tokens
        if total > 0:
            payload["inputTokens"] = self._total_input_tokens
            payload["outputTokens"] = self._total_output_tokens
            payload["totalTokens"] = total
        if self._context_window > 0:
            payload["contextWindow"] = self._context_window
        await self._emit(payload)
        await self._queue.put("data: [DONE]\n\n")

    async def _emit(self, event: ChatSseEventPayload) -> None:
        await self._queue.put(sse(event))
