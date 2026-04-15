"""Directory listing tools."""

from __future__ import annotations

import os

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

from sandbox import DaytonaClient

from ._common import resolve_sandbox_id


@tool
async def ls(
    path: str,
    config: RunnableConfig,
    **kwargs,
) -> dict[str, object]:
    """List files and directories in the sandbox (non-recursive)."""
    if not path:
        path = "."

    try:
        sandbox_id = await resolve_sandbox_id(config)
        if not sandbox_id:
            return {
                "status": "error",
                "message": "No session sandbox found",
                "path": path,
                "paths": [],
            }

        client = DaytonaClient()
        entries = await client.list_files(sandbox_id, path)

        paths: list[str] = []
        for entry in entries:
            entry_path = os.path.normpath(os.path.join(path, entry["name"]))
            if entry.get("is_dir"):
                entry_path = f"{entry_path}/"
            paths.append(entry_path)

        paths.sort(key=lambda p: p.lower())
        return {
            "status": "success",
            "path": path,
            "paths": paths,
            "message": f"Found {len(paths)} paths in {path}",
        }
    except Exception as e:
        return {
            "status": "error",
            "path": path,
            "paths": [],
            "message": f"Failed to list files: {str(e)}",
        }
