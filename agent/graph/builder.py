"""Graph builder."""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from state import AgentState

from .nodes import agent_node, should_continue, tools_node


def build_graph():
    """Build and return the LangGraph StateGraph."""
    workflow = StateGraph(AgentState)
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", tools_node)
    workflow.add_edge(START, "agent")
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            "__end__": END,
        },
    )
    workflow.add_edge("tools", "agent")
    return workflow
