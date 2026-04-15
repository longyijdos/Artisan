"""Read and write file tools."""

from __future__ import annotations

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

from sandbox import DaytonaClient
from tools._types import FileReadResponse, FileWriteResponse

from ._common import looks_like_binary_text, resolve_sandbox_id


def _format_with_line_numbers(lines: list[str], start_line: int) -> str:
    width = 6
    return "\n".join(
        f"{line_no:>{width}}:{line}"
        for line_no, line in enumerate(lines, start=start_line)
    )


@tool
async def write_file(
    file_path: str,
    content: str,
    config: RunnableConfig,
    **kwargs,
) -> FileWriteResponse:
    """
    Create a new file in the sandbox.

    Args:
        file_path: Absolute or relative path (relative to workspace root)
        content: File content to write
    """
    try:
        sandbox_id = await resolve_sandbox_id(config)
        if not sandbox_id:
            return {
                "status": "error",
                "message": "No session sandbox found",
                "path": file_path,
            }

        client = DaytonaClient()
        if await client.file_exists(sandbox_id, file_path):
            return {
                "status": "error",
                "message": (
                    f"Cannot write to {file_path} because it already exists. "
                    "Read and then make an edit, or write to a new path."
                ),
                "path": file_path,
            }

        await client.write_file(sandbox_id, file_path, content)

        return {
            "status": "success",
            "message": f"Updated file {file_path}",
            "path": file_path,
            "size": len(content),
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to write file: {str(e)}",
            "path": file_path,
        }


@tool
async def read_file(
    file_path: str,
    config: RunnableConfig,
    offset: int = 0,
    limit: int = 100,
    **kwargs,
) -> FileReadResponse:
    """
    Read file content in line-range form.

    Args:
        file_path: Absolute or relative path (relative to workspace root)
        offset: Start line offset (0-based)
        limit: Max lines to read
    """
    try:
        sandbox_id = await resolve_sandbox_id(config)
        if not sandbox_id:
            return {
                "status": "error",
                "message": "No session sandbox found",
                "path": file_path,
                "content": "",
            }

        client = DaytonaClient()
        content = await client.read_file(sandbox_id, file_path)

        if looks_like_binary_text(content):
            return {
                "status": "error",
                "content": "",
                "path": file_path,
                "message": "File appears to be binary; use execute_shell with xxd/base64 for inspection.",
            }

        lines = content.splitlines()
        total_lines = len(lines)

        if total_lines == 0:
            return {
                "status": "success",
                "content": "",
                "path": file_path,
                "offset": 0,
                "limit": limit,
                "total_lines": 0,
            }

        if offset < 0:
            offset = 0
        if limit <= 0:
            return {
                "status": "error",
                "content": "",
                "path": file_path,
                "message": "Invalid limit: must be greater than 0",
            }

        if offset >= total_lines:
            return {
                "status": "error",
                "content": "",
                "path": file_path,
                "message": f"Line offset {offset} exceeds file length ({total_lines} lines)",
                "total_lines": total_lines,
            }

        end_index = min(offset + limit, total_lines)
        selected_lines = lines[offset:end_index]
        formatted = _format_with_line_numbers(selected_lines, start_line=offset + 1)

        return {
            "status": "success",
            "content": formatted,
            "path": file_path,
            "offset": offset,
            "limit": limit,
            "total_lines": total_lines,
        }
    except Exception as e:
        return {
            "status": "error",
            "content": "",
            "message": f"Failed to read file: {str(e)}",
            "path": file_path,
        }
