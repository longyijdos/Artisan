"""File glob and grep tools (implemented via sandbox Python execution)."""

from __future__ import annotations

import json
from typing import Literal

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

from sandbox import DaytonaClient

from ._common import resolve_sandbox_id


def _extract_json_from_stdout(stdout: str) -> object:
    """Parse JSON from command stdout (last non-empty line)."""
    lines = [line.strip() for line in stdout.splitlines() if line.strip()]
    if not lines:
        raise ValueError("No JSON output")
    return json.loads(lines[-1])


@tool
async def glob(
    pattern: str,
    config: RunnableConfig,
    path: str = "/",
    **kwargs,
) -> dict[str, object]:
    """Find files matching a glob pattern."""
    try:
        if not pattern:
            return {
                "status": "error",
                "message": "pattern cannot be empty",
                "path": path,
                "paths": [],
            }

        sandbox_id = await resolve_sandbox_id(config)
        if not sandbox_id:
            return {
                "status": "error",
                "message": "No session sandbox found",
                "path": path,
                "paths": [],
            }

        client = DaytonaClient()
        base_path = path or "."

        script = f"""python3 - <<'PY'\nimport json\nfrom pathlib import Path\npattern = {pattern!r}\npaths = [p.as_posix() for p in Path('.').rglob(pattern) if p.is_file()]\npaths.sort()\nprint(json.dumps(paths, ensure_ascii=False))\nPY"""

        result = await client.exec_command(sandbox_id, script, cwd=base_path)
        if result["exit_code"] != 0:
            return {
                "status": "error",
                "path": base_path,
                "pattern": pattern,
                "paths": [],
                "message": f"glob command failed (exit_code={result['exit_code']})",
            }

        parsed = _extract_json_from_stdout(result.get("stdout", ""))
        if not isinstance(parsed, list):
            raise ValueError("Unexpected glob output")

        paths = [item for item in parsed if isinstance(item, str)]
        return {
            "status": "success",
            "path": base_path,
            "pattern": pattern,
            "paths": paths,
            "message": f"Found {len(paths)} paths matching '{pattern}'",
        }
    except Exception as e:
        return {
            "status": "error",
            "path": path,
            "pattern": pattern,
            "paths": [],
            "message": f"Failed to glob files: {str(e)}",
        }


@tool
async def grep(
    pattern: str,
    config: RunnableConfig,
    path: str | None = None,
    glob: str | None = None,
    output_mode: Literal["files_with_matches", "content", "count"] = "files_with_matches",
    **kwargs,
) -> dict[str, object]:
    """Search for a literal text pattern in files."""
    try:
        if not pattern:
            return {
                "status": "error",
                "message": "pattern cannot be empty",
                "matches": [],
            }

        sandbox_id = await resolve_sandbox_id(config)
        if not sandbox_id:
            return {
                "status": "error",
                "message": "No session sandbox found",
                "matches": [],
            }

        client = DaytonaClient()
        base_path = path or "."

        script = f"""python3 - <<'PY'\nimport fnmatch\nimport json\nfrom pathlib import Path\npattern = {pattern!r}\nfile_glob = {glob!r}\noutput_mode = {output_mode!r}\n\nfiles = [p for p in Path('.').rglob('*') if p.is_file()]\nif file_glob:\n    files = [p for p in files if fnmatch.fnmatch(p.name, file_glob) or fnmatch.fnmatch(p.as_posix(), file_glob)]\n\nmatches = []\nfile_counts = {{}}\nfor fp in files:\n    try:\n        text = fp.read_text(encoding='utf-8', errors='ignore')\n    except Exception:\n        continue\n\n    count = 0\n    for line_no, line in enumerate(text.splitlines(), start=1):\n        if pattern in line:\n            count += 1\n            matches.append({{'path': fp.as_posix(), 'line': line_no, 'text': line}})\n\n    if count > 0:\n        file_counts[fp.as_posix()] = count\n\nfiles_with_matches = sorted(file_counts.keys())\nresult = {{\n    'path': '.',\n    'pattern': pattern,\n    'glob': file_glob,\n    'output_mode': output_mode,\n    'message': f\"Found {{sum(file_counts.values())}} matches in {{len(file_counts)}} files\"\n}}\n\nif output_mode == 'files_with_matches':\n    result['files'] = files_with_matches\nelif output_mode == 'count':\n    result['counts'] = file_counts\nelse:\n    result['matches'] = matches\n\nprint(json.dumps(result, ensure_ascii=False))\nPY"""

        result = await client.exec_command(sandbox_id, script, cwd=base_path)
        if result["exit_code"] != 0:
            return {
                "status": "error",
                "path": base_path,
                "pattern": pattern,
                "glob": glob,
                "output_mode": output_mode,
                "matches": [],
                "message": f"grep command failed (exit_code={result['exit_code']})",
            }

        parsed = _extract_json_from_stdout(result.get("stdout", ""))
        if not isinstance(parsed, dict):
            raise ValueError("Unexpected grep output")

        parsed["status"] = "success"
        parsed["path"] = base_path
        return parsed
    except Exception as e:
        return {
            "status": "error",
            "path": path or ".",
            "pattern": pattern,
            "glob": glob,
            "output_mode": output_mode,
            "matches": [],
            "message": f"Failed to grep files: {str(e)}",
        }
