"""Shell tool implementations."""

from __future__ import annotations

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

from sandbox import DaytonaClient
from tools._runtime import resolve_sandbox_id
from tools._types import ShellToolResponse


@tool
async def execute_shell(
    command: str,
    config: RunnableConfig,
    cwd: str | None = None,
    timeout: int = 60,
    **kwargs,
) -> ShellToolResponse:
    """
    Execute a shell command in the sandbox.

    Args:
        command: The shell command to execute
        cwd: Working directory (default: None, uses sandbox default)
        timeout: Timeout in seconds for the command execution
    """
    try:
        sandbox_id = await resolve_sandbox_id(config)
        if not sandbox_id:
            return {
                "status": "error",
                "stdout": "",
                "stderr": "No session sandbox found",
                "exit_code": -1,
                "message": "No session sandbox found",
            }

        client = DaytonaClient()
        result = await client.exec_command(sandbox_id, command, cwd=cwd, timeout=timeout)

        exit_code = result.get("exit_code", -1)
        success = exit_code == 0

        return {
            "status": "success" if success else "error",
            "stdout": result.get("stdout", ""),
            "stderr": result.get("stderr", ""),
            "exit_code": exit_code,
            "message": (
                "Command executed successfully"
                if success
                else f"Command failed with exit code {exit_code}"
            ),
        }
    except Exception as e:
        return {
            "status": "error",
            "stdout": "",
            "stderr": str(e),
            "exit_code": -1,
            "message": f"Failed to execute command: {str(e)}",
        }
