import pytest
from fastapi import HTTPException

from schemas.chat import (
    ChatRunRequest,
    ChatStopRequest,
    normalize_chat_run_request,
    normalize_stop_thread_id,
)


def test_normalize_chat_run_request_trims_message_and_sets_defaults() -> None:
    normalized = normalize_chat_run_request(
        ChatRunRequest(
            thread_id="  thread-1  ",
            message="  hello artisan  ",
        )
    )

    assert normalized.thread_id == "thread-1"
    assert normalized.message == "hello artisan"
    assert normalized.tool_call_id == ""
    assert normalized.tool_result is None
    assert normalized.has_tool_result is False
    assert normalized.reasoning_mode is False
    assert normalized.attachments == []
    assert normalized.run_id.startswith("run-")


def test_normalize_chat_run_request_accepts_tool_response_payload() -> None:
    normalized = normalize_chat_run_request(
        ChatRunRequest(
            thread_id="thread-1",
            tool_call_id="  tool-1  ",
            tool_result={"ok": True},
            run_id="run-fixed",
            reasoning_mode=True,
            attachments=[{"path": "workspace/spec.md", "name": "spec.md", "size": 12}],
        )
    )

    assert normalized.thread_id == "thread-1"
    assert normalized.message == ""
    assert normalized.tool_call_id == "tool-1"
    assert normalized.tool_result == {"ok": True}
    assert normalized.has_tool_result is True
    assert normalized.reasoning_mode is True
    assert normalized.attachments == [
        {"path": "workspace/spec.md", "name": "spec.md", "size": 12}
    ]
    assert normalized.run_id == "run-fixed"


def test_normalize_chat_run_request_rejects_missing_thread_id() -> None:
    with pytest.raises(HTTPException) as exc_info:
        normalize_chat_run_request(ChatRunRequest(thread_id="   ", message="hello"))

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "thread_id is required"


def test_normalize_chat_run_request_rejects_missing_message_and_tool_payload() -> None:
    with pytest.raises(HTTPException) as exc_info:
        normalize_chat_run_request(ChatRunRequest(thread_id="thread-1"))

    assert exc_info.value.status_code == 400
    assert (
        exc_info.value.detail
        == "message is required, or provide tool_call_id and tool_result"
    )


def test_normalize_stop_thread_id_trims_values() -> None:
    assert normalize_stop_thread_id(ChatStopRequest(thread_id="  thread-1  ")) == "thread-1"
    assert normalize_stop_thread_id(ChatStopRequest(thread_id=None)) is None


def test_normalize_stop_thread_id_rejects_blank_values() -> None:
    with pytest.raises(HTTPException) as exc_info:
        normalize_stop_thread_id(ChatStopRequest(thread_id="   "))

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "thread_id must not be empty"
