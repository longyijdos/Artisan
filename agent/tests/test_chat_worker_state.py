from importlib import import_module

message_state_module = import_module("services.chat.worker._message_state")
tool_state_module = import_module("services.chat.worker._tool_state")

AssistantMessageState = message_state_module.AssistantMessageState
ToolCallState = tool_state_module.ToolCallState


def test_assistant_message_state_reuses_normalized_message_id() -> None:
    state = AssistantMessageState()

    first = state.to_ui_message_id(run_id="run-1", raw_id="msg-1")
    second = state.to_ui_message_id(run_id="run-1", raw_id="msg-1")

    assert first == "assistant-msg-1"
    assert second == first


def test_assistant_message_state_generates_incrementing_fallback_ids() -> None:
    state = AssistantMessageState()

    first = state.to_ui_message_id(run_id="run-1", raw_id=None)
    second = state.to_ui_message_id(run_id="run-1", raw_id=None)

    assert first == "assistant-run-1-1"
    assert second == "assistant-run-1-2"


def test_tool_call_state_reuses_generated_chunk_ids_by_index() -> None:
    state = ToolCallState()

    first = state.resolve_chunk_id(index=0, raw_id=None)
    second = state.resolve_chunk_id(index=0, raw_id=None)

    assert first == second


def test_tool_call_state_prefers_explicit_chunk_id() -> None:
    state = ToolCallState()

    resolved = state.resolve_chunk_id(index=0, raw_id="tool-call-1")

    assert resolved == "tool-call-1"
