"""LangGraph node implementations."""

from __future__ import annotations

import logging
from typing import Literal, cast

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.prebuilt import ToolNode

from models import get_llm, sanitize_messages_for_llm
from prompts import get_system_prompt
from state import AgentState
from utils.db import update_session_last_active

from ._context import (
    build_attachment_context,
    get_configurable,
    load_active_skills,
    normalize_attachments,
)
from ._tools import ALL_TOOLS, LLM_TOOLS, filter_backend_tool_calls

logger = logging.getLogger(__name__)


async def _build_knowledge_context(
    messages: list[BaseMessage],
    source_ids: list[int],
) -> str | None:
    """Retrieve relevant knowledge chunks based on the last human message.

    Only runs when *source_ids* is non-empty (user explicitly selected knowledge bases).
    Returns a formatted context string, or None if nothing relevant was found.
    Failures are silenced so that RAG never blocks the agent.
    """
    if not source_ids:
        return None

    try:
        from services.knowledge import search_chunks
        from utils.runtime import get_embedding_model

        # Bail out early if embedding model is not loaded
        if get_embedding_model() is None:
            return None

        # Find the last human message
        last_human: str | None = None
        for msg in reversed(messages):
            if isinstance(msg, HumanMessage):
                content = msg.content
                if isinstance(content, str):
                    last_human = content
                elif isinstance(content, list):
                    # Multi-modal message: extract text parts
                    text_parts = [p for p in content if isinstance(p, str)]
                    if text_parts:
                        last_human = " ".join(text_parts)
                break

        if not last_human:
            return None

        chunks = await search_chunks(
            owner_id="default",
            query=last_human,
            source_ids=source_ids,
        )
        if not chunks:
            return None

        # Format as knowledge context
        pieces = []
        for i, chunk in enumerate(chunks, 1):
            pieces.append(f"[{i}] (score={chunk.score:.2f})\n{chunk.content}")

        return "[知识库参考]\n" + "\n\n".join(pieces) + "\n[/知识库参考]"
    except Exception as exc:
        logger.debug("Knowledge retrieval skipped: %s", exc)
        return None


async def agent_node(
    state: AgentState,
    config: RunnableConfig,
) -> dict[str, list[BaseMessage]]:
    """LLM node that prepares context, invokes the model, and returns one assistant message."""
    configurable = get_configurable(config)
    thread_id_raw = configurable.get("thread_id")
    thread_id = thread_id_raw if isinstance(thread_id_raw, str) else None
    if thread_id:
        await update_session_last_active(thread_id)

    selected_model_raw = configurable.get("selected_model")
    selected_model = selected_model_raw if isinstance(selected_model_raw, str) else None
    llm = get_llm(selected_model)
    llm_with_tools = llm.bind_tools(LLM_TOOLS)

    active_skills = await load_active_skills(thread_id)
    system_message = SystemMessage(content=get_system_prompt(active_skills))

    attachments = normalize_attachments(configurable.get("current_attachments"))
    attachment_context = build_attachment_context(attachments)
    attachment_system_message = SystemMessage(content=attachment_context) if attachment_context else None

    history = sanitize_messages_for_llm(list(state.get("messages", [])))

    # RAG knowledge retrieval — only when user selected knowledge sources
    raw_source_ids = configurable.get("knowledge_source_ids")
    knowledge_source_ids: list[int] = raw_source_ids if isinstance(raw_source_ids, list) else []
    knowledge_context = await _build_knowledge_context(history, knowledge_source_ids)
    knowledge_message = SystemMessage(content=knowledge_context) if knowledge_context else None

    messages = (
        [system_message]
        + ([attachment_system_message] if attachment_system_message else [])
        + ([knowledge_message] if knowledge_message else [])
        + history
    )
    response = cast(BaseMessage, await llm_with_tools.ainvoke(messages, config))

    return {"messages": [response]}


def should_continue(state: AgentState) -> Literal["tools", "__end__"]:
    """Route to the tools node only when the last AI message contains backend tool calls."""
    messages = state.get("messages", [])
    if not messages:
        return "__end__"

    last_message = messages[-1]
    if isinstance(last_message, AIMessage) and last_message.tool_calls:
        if filter_backend_tool_calls(cast(list[object], last_message.tool_calls)):
            return "tools"

    return "__end__"


async def tools_node(
    state: AgentState,
    config: RunnableConfig,
) -> dict[str, list[BaseMessage]]:
    """Execute backend tools and return only the resulting tool messages."""
    messages = state.get("messages", [])
    if not messages:
        return {"messages": []}

    last_message = messages[-1]
    if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
        return {"messages": []}

    backend_tool_calls = filter_backend_tool_calls(cast(list[object], last_message.tool_calls))
    if not backend_tool_calls:
        return {"messages": []}

    backend_message = AIMessage(
        content=last_message.content,
        tool_calls=backend_tool_calls,
    )

    tool_node = ToolNode(ALL_TOOLS)
    result = await tool_node.ainvoke({"messages": [backend_message]}, config)
    raw_messages = result.get("messages", []) if isinstance(result, dict) else []
    messages = [message for message in raw_messages if isinstance(message, BaseMessage)]
    return {"messages": messages}
