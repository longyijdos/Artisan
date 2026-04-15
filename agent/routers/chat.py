"""Custom chat endpoints (SSE streaming, no AG-UI request protocol)."""

from typing import Optional

from fastapi import APIRouter, Query, Request

from schemas.chat import ChatRunRequest, ChatStopRequest, ChatStopResponse, normalize_stop_thread_id
from services.chat import (
    create_chat_stream_response,
    load_chat_history_page,
    stop_chat_runs,
)

router = APIRouter(prefix="/chat", tags=["chat"])


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/run")
async def run_chat_stream(request_payload: ChatRunRequest, request: Request):
    """
    Run one chat turn with SSE output.

    Event types:
    - RUN_STARTED / RUN_FINISHED / RUN_ERROR
    - TEXT_MESSAGE_START / TEXT_MESSAGE_CONTENT / TEXT_MESSAGE_END
    - TOOL_CALL_START / TOOL_CALL_ARGS_DELTA / TOOL_CALL_END
    - [DONE]
    """
    return await create_chat_stream_response(request_payload, request)


@router.post("/stop")
async def stop_chat(payload: ChatStopRequest) -> ChatStopResponse:
    thread_id = normalize_stop_thread_id(payload)
    stopped = await stop_chat_runs(thread_id)

    return {
        "ok": True,
        "stopped": stopped,
        "thread_id": thread_id,
    }


@router.get("/history/{thread_id}")
async def get_chat_history(
    thread_id: str,
    before: Optional[int] = Query(default=None, ge=0),
    limit: int = Query(default=80, ge=1, le=500),
):
    return await load_chat_history_page(thread_id, before=before, limit=limit)
