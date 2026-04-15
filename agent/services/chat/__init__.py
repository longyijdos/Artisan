"""Chat service — stream worker, run management, and helpers."""

from .history_service import load_chat_history_page
from .run_manager import ActiveRun, register_run, stop_all, stop_one, unregister_run
from .stream_service import create_chat_stream_response, start_chat_run, stop_chat_runs
from .utils import (
    content_to_text,
    format_history_messages,
    normalize_tool_args,
    normalize_tool_result,
    persist_partial_assistant_message,
    sse,
)
from .worker import ChatStreamWorker

__all__ = [
    "sse",
    "content_to_text",
    "format_history_messages",
    "normalize_tool_args",
    "normalize_tool_result",
    "persist_partial_assistant_message",
    "ActiveRun",
    "register_run",
    "unregister_run",
    "stop_one",
    "stop_all",
    "ChatStreamWorker",
    "load_chat_history_page",
    "create_chat_stream_response",
    "start_chat_run",
    "stop_chat_runs",
]
