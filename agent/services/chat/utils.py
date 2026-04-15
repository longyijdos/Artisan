"""Shared helpers for the chat service (pure functions, no state)."""

import json
import logging
import uuid
from typing import cast

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph.state import CompiledStateGraph

from schemas.chat import (
    ChatAttachmentPayload,
    ChatHistoryMessagePayload,
    ChatHistoryToolCallPayload,
    ChatSseEventPayload,
    JsonObject,
)

logger = logging.getLogger(__name__)


def sse(event: ChatSseEventPayload) -> str:
    """Encode *event* as an SSE ``data:`` line."""
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


def content_to_text(content: object) -> str:
    """Extract plain-text from LangChain message content (str | list)."""
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
                continue
            if isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str):
                parts.append(item["text"])
        if parts:
            return "".join(parts)

    if content is None:
        return ""

    return str(content)


def format_history_messages(messages: list[object]) -> list[ChatHistoryMessagePayload]:
    """Convert LangChain messages to the frontend history format."""
    formatted: list[ChatHistoryMessagePayload] = []
    for msg in messages:
        msg_content = getattr(msg, "content", "")
        role = "user"
        if isinstance(msg, AIMessage):
            role = "assistant"
        elif isinstance(msg, ToolMessage):
            role = "tool"

        msg_dict: ChatHistoryMessagePayload = {
            "id": getattr(msg, "id", None) or str(uuid.uuid4()),
            "role": role,
            "content": msg_content if isinstance(msg_content, str) else str(msg_content),
        }

        # Include reasoning content from reasoning models (e.g. deepseek-reasoner)
        if isinstance(msg, AIMessage):
            additional_kwargs = getattr(msg, "additional_kwargs", {}) or {}
            reasoning = additional_kwargs.get("reasoning_content", "")
            if reasoning:
                msg_dict["reasoning_content"] = reasoning

        if isinstance(msg, HumanMessage):
            additional_kwargs = getattr(msg, "additional_kwargs", {}) or {}
            attachments = additional_kwargs.get("attachments")
            if isinstance(attachments, list):
                normalized: list[ChatAttachmentPayload] = []
                for item in attachments:
                    if not isinstance(item, dict):
                        continue
                    path = item.get("path")
                    name = item.get("name")
                    size = item.get("size")
                    mime_type = item.get("mimeType")
                    if not isinstance(path, str) or not path.strip():
                        continue
                    attachment: ChatAttachmentPayload = {
                        "name": name if isinstance(name, str) else "",
                        "path": path,
                        "size": size if isinstance(size, int) else 0,
                        "mimeType": mime_type if isinstance(mime_type, str) else "",
                    }
                    identifier = item.get("id")
                    if isinstance(identifier, str) and identifier.strip():
                        attachment["id"] = identifier
                    normalized.append(attachment)
                if normalized:
                    msg_dict["attachments"] = normalized

        if isinstance(msg, AIMessage) and msg.tool_calls:
            msg_dict["tool_calls"] = cast(list[ChatHistoryToolCallPayload], [
                {
                    "id": tc.get("id"),
                    "type": "function",
                    "function": {
                        "name": tc.get("name"),
                        "arguments": json.dumps(tc.get("args", {})),
                    },
                }
                for tc in msg.tool_calls
            ])

        if isinstance(msg, ToolMessage):
            msg_dict["tool_call_id"] = msg.tool_call_id

        formatted.append(msg_dict)

    return formatted


def normalize_tool_args(raw_args: object) -> JsonObject:
    """Normalise raw tool arguments into a dict."""
    if isinstance(raw_args, dict):
        return cast(JsonObject, raw_args)
    if isinstance(raw_args, str):
        stripped = raw_args.strip()
        if not stripped:
            return {}
        try:
            parsed = json.loads(stripped)
            if isinstance(parsed, dict):
                return cast(JsonObject, parsed)
            return {"input": parsed}
        except Exception:
            return {"input": raw_args}
    return {}


def normalize_tool_result(raw_content: object) -> object:
    """Normalise raw tool output into a JSON-serialisable value."""
    if isinstance(raw_content, str):
        stripped = raw_content.strip()
        if not stripped:
            return {"output": ""}
        try:
            return json.loads(stripped)
        except Exception:
            return {"output": raw_content}

    if isinstance(raw_content, list):
        text_parts: list[str] = []
        for item in raw_content:
            if isinstance(item, str):
                text_parts.append(item)
                continue
            if isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str):
                text_parts.append(item["text"])
        if text_parts:
            merged = "".join(text_parts)
            try:
                return json.loads(merged)
            except Exception:
                return {"output": merged}
        return raw_content

    return raw_content


async def persist_partial_assistant_message(
    compiled_graph: CompiledStateGraph,
    config: RunnableConfig,
    message_id: str,
    content: str,
) -> None:
    """Best-effort persistence for interrupted assistant output."""
    if not content.strip():
        return
    try:
        await compiled_graph.aupdate_state(
            config,
            {"messages": [AIMessage(id=message_id, content=content)]},
            as_node="agent",
        )
    except Exception:
        logger.warning(
            "Failed to persist partial assistant message: id=%s",
            message_id,
            exc_info=True,
        )
