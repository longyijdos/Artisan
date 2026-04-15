"""History loading for chat threads."""

import logging

from fastapi import HTTPException
from langchain_core.runnables import RunnableConfig

from schemas.chat import ChatHistoryResponse
from utils.runtime import get_compiled_graph

from .utils import format_history_messages

logger = logging.getLogger(__name__)


async def load_chat_history_page(
    thread_id: str,
    before: int | None = None,
    limit: int = 80,
) -> ChatHistoryResponse:
    normalized_thread_id = thread_id.strip()
    if not normalized_thread_id:
        raise HTTPException(status_code=400, detail="thread_id is required")

    compiled_graph = get_compiled_graph()
    if not compiled_graph:
        raise HTTPException(status_code=503, detail="graph not initialized")

    config: RunnableConfig = {"configurable": {"thread_id": normalized_thread_id}}
    try:
        state = await compiled_graph.aget_state(config)
    except Exception as exc:
        logger.exception("Failed to load chat history: thread=%s", normalized_thread_id)
        raise HTTPException(status_code=500, detail="Failed to load chat history") from exc

    if not state or not state.values:
        return {"messages": []}

    messages = state.values.get("messages", [])
    total = len(messages)
    end = total if before is None else min(before, total)
    start = max(0, end - limit)
    page = messages[start:end]
    has_more = start > 0

    return {
        "messages": format_history_messages(page),
        "paging": {
            "total": total,
            "before": before,
            "next_before": start if has_more else None,
            "limit": limit,
            "has_more": has_more,
        },
    }
