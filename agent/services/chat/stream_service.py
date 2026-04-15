"""Service helpers for starting and stopping streaming chat runs."""

import asyncio
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass

from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse
from langgraph.graph.state import CompiledStateGraph

from config import LLM_LITE_MODEL, LLM_MODEL
from schemas.chat import ChatRunRequest, normalize_chat_run_request
from utils.runtime import get_compiled_graph

from .run_manager import ActiveRun, register_run, stop_all, stop_one
from .worker import ChatStreamWorker

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class StartedChatRun:
    thread_id: str
    run_id: str
    queue: asyncio.Queue[str | None]
    task: asyncio.Task[None]
    stop_event: asyncio.Event


def _resolve_selected_model(reasoning_mode: bool) -> str:
    return LLM_MODEL if reasoning_mode else LLM_LITE_MODEL


def _require_compiled_graph() -> CompiledStateGraph:
    compiled_graph = get_compiled_graph()
    if not compiled_graph:
        raise HTTPException(status_code=503, detail="graph not initialized")
    return compiled_graph


async def start_chat_run(request_payload: ChatRunRequest) -> StartedChatRun:
    normalized = normalize_chat_run_request(request_payload)
    compiled_graph = _require_compiled_graph()
    selected_model = _resolve_selected_model(normalized.reasoning_mode)

    queue: asyncio.Queue[str | None] = asyncio.Queue()
    stop_event = asyncio.Event()
    worker = ChatStreamWorker(
        compiled_graph=compiled_graph,
        thread_id=normalized.thread_id,
        run_id=normalized.run_id,
        queue=queue,
        stop_event=stop_event,
        message=normalized.message,
        tool_call_id=normalized.tool_call_id,
        tool_result=normalized.tool_result,
        selected_model=selected_model,
        attachments=normalized.attachments if normalized.message else [],
        knowledge_source_ids=normalized.knowledge_source_ids,
    )

    logger.info(
        "Model selected by reasoning_mode: thread=%s run=%s model=%s reasoning_mode=%s",
        normalized.thread_id,
        normalized.run_id,
        selected_model,
        normalized.reasoning_mode,
    )

    task = asyncio.create_task(
        worker.run(),
        name=f"chat-run:{normalized.thread_id}:{normalized.run_id}",
    )
    await register_run(
        normalized.thread_id,
        ActiveRun(
            thread_id=normalized.thread_id,
            run_id=normalized.run_id,
            task=task,
            stop_event=stop_event,
        ),
    )

    return StartedChatRun(
        thread_id=normalized.thread_id,
        run_id=normalized.run_id,
        queue=queue,
        task=task,
        stop_event=stop_event,
    )


async def stream_chat_events(
    request: Request,
    started_run: StartedChatRun,
) -> AsyncIterator[str]:
    try:
        while True:
            if await request.is_disconnected():
                started_run.stop_event.set()
                started_run.task.cancel()
                break
            try:
                data = await asyncio.wait_for(started_run.queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue
            if data is None:
                break
            yield data
    finally:
        started_run.stop_event.set()
        started_run.task.cancel()


async def create_chat_stream_response(
    request_payload: ChatRunRequest,
    request: Request,
) -> StreamingResponse:
    started_run = await start_chat_run(request_payload)
    return StreamingResponse(
        stream_chat_events(request, started_run),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def stop_chat_runs(thread_id: str | None) -> int:
    if thread_id:
        return 1 if await stop_one(thread_id) else 0
    return await stop_all()
