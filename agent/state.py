"""LangGraph state definition."""

from typing import Annotated, Sequence, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict, total=False):
    """State for the LangGraph agent."""

    # Messages with add_messages reducer for proper message handling
    messages: Annotated[Sequence[BaseMessage], add_messages]
