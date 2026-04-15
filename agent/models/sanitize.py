"""Message sanitization utilities for LLM requests."""

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage

from config import LLM_MODEL


def _clone_ai_without_tool_calls(message: AIMessage) -> AIMessage | None:
    """Strip tool_calls from an AIMessage, keeping text content. Returns None if empty."""
    content = getattr(message, "content", None) or ""
    if not content:
        return None
    if hasattr(message, "model_copy"):
        return message.model_copy(update={"tool_calls": None})
    if hasattr(message, "copy"):
        return message.copy(update={"tool_calls": None})
    return AIMessage(content=content)


def _strip_reasoning_content(message: AIMessage) -> AIMessage:
    """Remove reasoning_content from an AIMessage's additional_kwargs.

    Per DeepSeek docs, reasoning_content from previous turns should NOT be
    sent to the API in new turns.
    """
    ak = getattr(message, "additional_kwargs", None)
    if not ak or "reasoning_content" not in ak:
        return message
    new_ak = {k: v for k, v in ak.items() if k != "reasoning_content"}
    if hasattr(message, "model_copy"):
        return message.model_copy(update={"additional_kwargs": new_ak})
    if hasattr(message, "copy"):
        return message.copy(update={"additional_kwargs": new_ak})
    return AIMessage(
        content=message.content,
        tool_calls=getattr(message, "tool_calls", None),
        additional_kwargs=new_ak,
    )


def sanitize_messages_for_llm(messages: list[BaseMessage]) -> list[BaseMessage]:
    """Fix message history so it respects tool-calling protocol expected by LLM providers.

    When a backend tool execution is interrupted mid-way (user clicks Stop), the
    checkpoint may contain an AIMessage with tool_calls but missing the corresponding
    ToolMessages.  Sending such incomplete blocks to the LLM causes errors.

    Rules:
    - An AIMessage with tool_calls must be followed by a ToolMessage for *every* call.
    - If the block is incomplete, strip tool_calls (keep text content if any).
    - Drop orphan ToolMessages that have no preceding AIMessage expecting them.

    For deepseek-reasoner models:
    - reasoning_content in the CURRENT tool-call turn must be preserved (same turn).
    - reasoning_content from PREVIOUS turns (before the latest HumanMessage) is stripped.
    """
    sanitized: list[BaseMessage] = []

    pending_ai: AIMessage | None = None
    pending_required_ids: set[str] | None = None
    pending_received_ids: set[str] | None = None
    pending_tool_messages: list[ToolMessage] | None = None

    def flush_pending(drop_tools: bool) -> None:
        nonlocal pending_ai, pending_required_ids, pending_received_ids, pending_tool_messages, sanitized
        if pending_ai is None:
            return

        if drop_tools:
            cloned = _clone_ai_without_tool_calls(pending_ai)
            if cloned is not None:
                sanitized.append(cloned)
        else:
            sanitized.append(pending_ai)
            if pending_tool_messages:
                sanitized.extend(pending_tool_messages)

        pending_ai = None
        pending_required_ids = None
        pending_received_ids = None
        pending_tool_messages = None

    for msg in messages:
        if pending_ai is not None:
            if isinstance(msg, ToolMessage):
                tool_call_id = getattr(msg, "tool_call_id", None)
                if tool_call_id and pending_required_ids and tool_call_id in pending_required_ids:
                    pending_tool_messages.append(msg)  # type: ignore[union-attr]
                    pending_received_ids.add(tool_call_id)  # type: ignore[union-attr]
                    if pending_received_ids == pending_required_ids:
                        flush_pending(drop_tools=False)
                    continue
                continue

            flush_pending(drop_tools=True)

        if isinstance(msg, ToolMessage):
            continue

        if isinstance(msg, AIMessage) and getattr(msg, "tool_calls", None):
            tool_calls = getattr(msg, "tool_calls", None) or []
            required_ids = {tc.get("id") for tc in tool_calls if isinstance(tc, dict) and tc.get("id")}
            if not required_ids:
                cloned = _clone_ai_without_tool_calls(msg)
                if cloned is not None:
                    sanitized.append(cloned)
                continue

            pending_ai = msg
            pending_required_ids = set(required_ids)  # type: ignore[arg-type]
            pending_received_ids = set()
            pending_tool_messages = []
            continue

        sanitized.append(msg)

    if pending_ai is not None:
        flush_pending(drop_tools=True)

    # For deepseek models: strip reasoning_content from previous turns.
    if "deepseek" in LLM_MODEL.lower() and sanitized:
        last_human_idx = -1
        for i in range(len(sanitized) - 1, -1, -1):
            if isinstance(sanitized[i], HumanMessage):
                last_human_idx = i
                break

        for i in range(len(sanitized)):
            msg = sanitized[i]
            if isinstance(msg, AIMessage) and i < last_human_idx:
                sanitized[i] = _strip_reasoning_content(msg)

    return sanitized
