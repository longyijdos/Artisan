"""Shared runtime helpers for tool execution."""

from __future__ import annotations

from langchain_core.runnables import RunnableConfig

from utils.db import get_sandbox_id_for_thread


def get_thread_id(config: RunnableConfig | None) -> str | None:
    if not isinstance(config, dict):
        return None
    configurable = config.get("configurable")
    if not isinstance(configurable, dict):
        return None
    thread_id = configurable.get("thread_id")
    return thread_id if isinstance(thread_id, str) and thread_id.strip() else None


async def resolve_sandbox_id(config: RunnableConfig | None) -> str | None:
    thread_id = get_thread_id(config)
    if not thread_id:
        return None
    return await get_sandbox_id_for_thread(thread_id)
