"""File editing tools."""

from __future__ import annotations

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

from sandbox import DaytonaClient
from tools._types import FileEditResponse

from ._common import resolve_sandbox_id


@tool
async def edit_file(
    file_path: str,
    old_string: str,
    new_string: str,
    config: RunnableConfig,
    replace_all: bool = False,
    **kwargs,
) -> FileEditResponse:
    """
    Edit file content by replacing old_string with new_string.

    Args:
        file_path: The target file path
        old_string: Exact text to find
        new_string: Replacement text
        replace_all: Replace all occurrences when True; otherwise require unique match
    """
    try:
        if not old_string:
            return {
                "status": "error",
                "message": "old_string cannot be empty",
                "path": file_path,
            }

        sandbox_id = await resolve_sandbox_id(config)
        if not sandbox_id:
            return {
                "status": "error",
                "message": "No session sandbox found",
                "path": file_path,
            }

        client = DaytonaClient()
        original = await client.read_file(sandbox_id, file_path)
        occurrences = original.count(old_string)
        if occurrences == 0:
            return {
                "status": "error",
                "message": "old_string not found in file",
                "path": file_path,
                "replacements": 0,
            }

        if not replace_all and occurrences > 1:
            return {
                "status": "error",
                "message": (
                    "old_string appears multiple times. "
                    "Use more specific text or set replace_all=true."
                ),
                "path": file_path,
                "replacements": 0,
                "available_matches": occurrences,
            }

        replacements = occurrences if replace_all else 1
        updated = (
            original.replace(old_string, new_string)
            if replace_all
            else original.replace(old_string, new_string, 1)
        )
        await client.write_file(sandbox_id, file_path, updated)

        return {
            "status": "success",
            "message": f"Successfully replaced {replacements} instance(s) in '{file_path}'",
            "path": file_path,
            "replacements": replacements,
            "available_matches": occurrences,
            "size": len(updated),
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to edit file: {str(e)}",
            "path": file_path,
        }
