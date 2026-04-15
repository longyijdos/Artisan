"""Session service — CRUD, sandbox pool management, and auto-naming."""

from .manager import (
    autoname_from_message,
    create_session,
    delete_session,
    get_pool_stats,
    list_sessions,
    update_session_title,
)

__all__ = [
    "list_sessions",
    "create_session",
    "delete_session",
    "update_session_title",
    "get_pool_stats",
    "autoname_from_message",
]
