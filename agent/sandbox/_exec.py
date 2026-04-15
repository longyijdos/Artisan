"""Command execution mixin for DaytonaClient."""

from __future__ import annotations

import logging

from daytona import AsyncSandbox

from sandbox._types import ExecCommandResult

from ._constants import TimeoutConfig
from ._protocols import DaytonaClientProtocol

logger = logging.getLogger(__name__)


class DaytonaExecMixin:
    """Execute shell commands inside a sandbox."""

    async def exec_command(
        self: DaytonaClientProtocol,
        sandbox_id: str,
        command: str,
        cwd: str | None = None,
        timeout: int = TimeoutConfig.COMMAND_EXEC,
    ) -> ExecCommandResult:
        """Run *command* in the sandbox and return ``{exit_code, stdout, stderr}``."""
        sandbox: AsyncSandbox = await self.get_sandbox(sandbox_id)

        exec_cwd = (
            await self.validate_read_path(sandbox_id, cwd)
            if cwd
            else await self.get_working_directory(sandbox_id)
        )

        response = await sandbox.process.exec(
            command=command,
            cwd=exec_cwd,
            timeout=timeout,
        )

        logger.info(f"Exec response for '{command[:50]}...': exit_code={response.exit_code}")

        return {
            "exit_code": response.exit_code,
            "stdout": response.result if isinstance(response.result, str) else str(response.result),
            "stderr": "",
        }
