"""Worker-specific constants."""

from __future__ import annotations

STREAMABLE_TOOL_NAMES = frozenset({"write_file", "edit_file", "ask_user", "update_plan"})

FRONTEND_TOOL_NAMES = frozenset({"ask_user", "update_plan"})

__all__ = ["FRONTEND_TOOL_NAMES", "STREAMABLE_TOOL_NAMES"]
