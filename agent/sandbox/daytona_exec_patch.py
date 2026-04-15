"""
Monkey-patch for Daytona SDK's process.exec() method.

问题：Daytona SDK 在 exec() 中将所有命令用 base64 编码后通过
      `echo '<b64>' | base64 -d | sh` 的方式执行，这种模式会被
      主机安全Agent（规则 111040）识别为"可疑命令"。

补丁：替换 exec() 方法，直接用 `sh -c "<command>"` 执行，
      不再经过 base64 编码。对于环境变量同样直接 export。

使用方式：在 daytona_client.py 初始化时调用 apply_exec_patch()。
删除方式：删除此文件并移除 daytona_client.py 中的 apply 调用即可恢复。
"""

from __future__ import annotations

import logging
import shlex
from typing import Dict, Optional

logger = logging.getLogger(__name__)

_patched = False


def apply_exec_patch() -> None:
    """Apply the monkey-patch to both sync and async Process.exec()."""
    global _patched
    if _patched:
        return

    try:
        _patch_sync_process()
    except Exception as e:
        logger.warning(f"Failed to patch sync Process.exec: {e}")

    try:
        _patch_async_process()
    except Exception as e:
        logger.warning(f"Failed to patch async AsyncProcess.exec: {e}")

    _patched = True
    logger.info("Daytona exec monkey-patch applied (bypass base64 encoding)")


def _patch_sync_process() -> None:
    from daytona._sync.process import Process
    from daytona._utils.errors import intercept_errors
    from daytona.common.process import ExecuteResponse
    from daytona_toolbox_api_client import ExecuteRequest

    original_parse_output = Process._parse_output

    @intercept_errors(message_prefix="Failed to execute command: ")
    def patched_exec(
        self,
        command: str,
        cwd: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
        timeout: Optional[int] = None,
    ) -> ExecuteResponse:
        # Build env exports without base64
        if env and len(env.items()) > 0:
            safe_env_exports = ";".join(
                f"export {key}={shlex.quote(value)}"
                for key, value in env.items()
            ) + ";"
            full_cmd = f"{safe_env_exports} {command}"
        else:
            full_cmd = command

        # Use sh -c with the command directly (no base64 wrapping)
        wrapped = f"sh -c {shlex.quote(full_cmd)}"
        execute_request = ExecuteRequest(command=wrapped, cwd=cwd, timeout=timeout)

        response = self._api_client.execute_command(request=execute_request)

        artifacts = original_parse_output(response.result.splitlines())

        return ExecuteResponse.model_construct(
            exit_code=(
                response.exit_code
                if response.exit_code is not None
                else response.additional_properties.get("code")
            ),
            result=artifacts.stdout,
            artifacts=artifacts,
            additional_properties=response.additional_properties,
        )

    Process.exec = patched_exec
    logger.info("Patched daytona._sync.process.Process.exec")


def _patch_async_process() -> None:
    from daytona._async.process import AsyncProcess
    from daytona._utils.errors import intercept_errors
    from daytona.common.process import ExecuteResponse
    from daytona_toolbox_api_client_async import ExecuteRequest

    original_parse_output = AsyncProcess._parse_output

    @intercept_errors(message_prefix="Failed to execute command: ")
    async def patched_exec(
        self,
        command: str,
        cwd: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
        timeout: Optional[int] = None,
    ) -> ExecuteResponse:
        # Build env exports without base64
        if env and len(env.items()) > 0:
            safe_env_exports = ";".join(
                f"export {key}={shlex.quote(value)}"
                for key, value in env.items()
            ) + ";"
            full_cmd = f"{safe_env_exports} {command}"
        else:
            full_cmd = command

        # Use sh -c with the command directly (no base64 wrapping)
        wrapped = f"sh -c {shlex.quote(full_cmd)}"
        execute_request = ExecuteRequest(command=wrapped, cwd=cwd, timeout=timeout)

        response = await self._api_client.execute_command(request=execute_request)

        artifacts = original_parse_output(response.result.splitlines())

        return ExecuteResponse.model_construct(
            exit_code=(
                response.exit_code
                if response.exit_code is not None
                else response.additional_properties.get("code")
            ),
            result=artifacts.stdout,
            artifacts=artifacts,
            additional_properties=response.additional_properties,
        )

    AsyncProcess.exec = patched_exec
    logger.info("Patched daytona._async.process.AsyncProcess.exec")
