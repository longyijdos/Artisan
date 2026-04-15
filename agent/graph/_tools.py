"""Tool wiring for the LangGraph agent."""

from __future__ import annotations

from typing import cast

from tools.file_tools import FILE_TOOLS
from tools.frontend_tools import FRONTEND_TOOLS
from tools.search_tools import SEARCH_TOOLS
from tools.shell_tools import SHELL_TOOLS
from tools.skill_tools import SKILL_TOOLS

ALL_TOOLS = FILE_TOOLS + SHELL_TOOLS + SEARCH_TOOLS + SKILL_TOOLS
LLM_TOOLS = ALL_TOOLS + FRONTEND_TOOLS

BACKEND_TOOL_NAMES = {tool.name for tool in ALL_TOOLS}


def filter_backend_tool_calls(tool_calls: list[object]) -> list[dict[str, object]]:
    filtered: list[dict[str, object]] = []
    for tool_call in tool_calls:
        if not isinstance(tool_call, dict):
            continue
        tool_name = tool_call.get("name")
        if isinstance(tool_name, str) and tool_name in BACKEND_TOOL_NAMES:
            filtered.append(cast(dict[str, object], tool_call))
    return filtered
