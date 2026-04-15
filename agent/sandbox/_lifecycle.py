"""Sandbox lifecycle management mixin (create / get / remove / ensure running)."""

from __future__ import annotations

import asyncio
import logging

from daytona import AsyncSandbox, CodeLanguage, CreateSandboxFromSnapshotParams

from ._constants import SandboxState, TimeoutConfig
from ._protocols import DaytonaClientProtocol

logger = logging.getLogger(__name__)


class DaytonaLifecycleMixin:
    """Methods for sandbox creation, retrieval, deletion, and state recovery.

    Mixed into :class:`DaytonaClient` — *self* is always a ``DaytonaClient``
    instance at runtime.
    """

    # -- public ------------------------------------------------------------

    async def create_sandbox(
        self: DaytonaClientProtocol,
        sandbox_id: str,
        upload_skills: bool = True,
    ) -> AsyncSandbox:
        """Create a new sandbox.

        Raises:
            RuntimeError: If *sandbox_id* already exists.
        """
        try:
            await self.client.get(sandbox_id)
            raise RuntimeError(f"Sandbox {sandbox_id} already exists")
        except RuntimeError:
            raise
        except Exception:
            pass

        params = CreateSandboxFromSnapshotParams(
            language=CodeLanguage.PYTHON,
            name=sandbox_id,
            auto_stop_interval=0,
            snapshot=self.default_snapshot if self.default_snapshot else None,
        )

        snapshot_info = f" from snapshot: {self.default_snapshot}" if self.default_snapshot else ""
        logger.info(f"Creating sandbox {sandbox_id}{snapshot_info}")
        sandbox = await self.client.create(params=params)
        logger.info(f"Sandbox created: {sandbox.id}")

        try:
            workspace_dir = await self.get_working_directory(sandbox.id)
            await sandbox.fs.create_folder(workspace_dir, mode="755")
        except Exception as e:
            logger.warning(f"Could not create workspace directory: {e}")

        if upload_skills:
            await self._upload_skills(sandbox, sandbox_id)

        return sandbox

    async def get_sandbox(
        self: DaytonaClientProtocol,
        sandbox_id: str,
        ensure_running: bool = True,
    ) -> AsyncSandbox:
        """Retrieve a sandbox instance, optionally ensuring it is running.

        Raises:
            RuntimeError: If the sandbox does not exist or cannot be started.
        """
        try:
            sandbox = await self.client.get(sandbox_id)
        except Exception as e:
            logger.error(f"Sandbox {sandbox_id} not found: {e}")
            raise RuntimeError(f"Sandbox {sandbox_id} does not exist") from e

        if ensure_running:
            await sandbox.refresh_data()
            if sandbox.state != SandboxState.STARTED:
                if not await self._ensure_running(sandbox, sandbox_id):
                    raise RuntimeError(f"Cannot ensure sandbox {sandbox_id} is running")

        return sandbox

    async def remove_sandbox(self: DaytonaClientProtocol, sandbox_id: str) -> None:
        """Delete a sandbox."""
        logger.info(f"Removing sandbox: {sandbox_id}")
        try:
            sandbox = await self.client.get(sandbox_id)
            await sandbox.delete()
            logger.info(f"Sandbox {sandbox_id} deleted successfully")
        except Exception as e:
            logger.warning(f"Failed to delete sandbox {sandbox_id}: {e}")

    async def configure_session_lifecycle(
        self: DaytonaClientProtocol,
        sandbox_id: str,
        auto_stop_minutes: int,
        auto_archive_minutes: int = 1440,
    ) -> None:
        """Configure auto-stop and auto-archive intervals."""
        try:
            sandbox = await self.get_sandbox(sandbox_id, ensure_running=False)
            await sandbox.set_autostop_interval(auto_stop_minutes)
            await sandbox.set_auto_archive_interval(auto_archive_minutes)
            logger.info(
                f"Configured lifecycle for sandbox {sandbox_id}: "
                f"auto_stop={auto_stop_minutes}min, auto_archive={auto_archive_minutes}min"
            )
        except Exception as e:
            logger.error(f"Failed to configure lifecycle for sandbox {sandbox_id}: {e}")
            raise

    async def get_terminal_url(self: DaytonaClientProtocol, sandbox_id: str) -> str:
        """Return the interactive terminal URL for a sandbox.

        Raises:
            RuntimeError: If the URL cannot be obtained.
        """
        try:
            sandbox = await self.get_sandbox(sandbox_id)
            preview = await sandbox.get_preview_link(22222)
            return preview.url
        except Exception as e:
            logger.error(f"Failed to get terminal URL for sandbox {sandbox_id}: {e}")
            raise RuntimeError(f"Cannot get terminal URL for sandbox {sandbox_id}") from e

    async def ensure_sandbox_running(self: DaytonaClientProtocol, sandbox_id: str) -> bool:
        """Ensure a sandbox is running (used by health checks)."""
        try:
            sandbox = await self.client.get(sandbox_id)
            return await self._ensure_running(sandbox, sandbox_id)
        except Exception as e:
            logger.warning(f"Failed to get sandbox {sandbox_id}: {e}")
            return False

    # -- private -----------------------------------------------------------

    async def _ensure_running(
        self: DaytonaClientProtocol,
        sandbox: AsyncSandbox,
        sandbox_id: str,
    ) -> bool:
        """Bring *sandbox* to the ``started`` state regardless of its current state."""
        state = sandbox.state

        try:
            if state == SandboxState.STARTED:
                return True

            if state in (SandboxState.STOPPED, SandboxState.ARCHIVED):
                logger.info(f"Sandbox {sandbox_id} is '{state}', starting...")
                if await self._start_sandbox(sandbox, sandbox_id, timeout=TimeoutConfig.STATE_TRANSITION):
                    logger.info(f"Sandbox {sandbox_id} recovered from '{state}' state")
                    return True
                return False

            if state == SandboxState.STOPPING:
                logger.info(f"Sandbox {sandbox_id} is stopping, waiting...")
                await sandbox.wait_for_sandbox_stop(timeout=float(TimeoutConfig.STATE_TRANSITION))
                logger.info(f"Sandbox {sandbox_id} stopped, now starting...")
                if await self._start_sandbox(sandbox, sandbox_id):
                    logger.info(f"Sandbox {sandbox_id} recovered from stopping state")
                    return True
                return False

            if state == SandboxState.ARCHIVING:
                logger.info(f"Sandbox {sandbox_id} is archiving, waiting for archived state...")
                elapsed = 0
                while elapsed < TimeoutConfig.STATE_TRANSITION:
                    await asyncio.sleep(TimeoutConfig.POLL_INTERVAL)
                    elapsed += TimeoutConfig.POLL_INTERVAL
                    await sandbox.refresh_data()
                    if sandbox.state == SandboxState.ARCHIVED:
                        logger.info(f"Sandbox {sandbox_id} archived, now starting...")
                        if await self._start_sandbox(sandbox, sandbox_id, timeout=TimeoutConfig.STATE_TRANSITION):
                            logger.info(f"Sandbox {sandbox_id} recovered from archiving state")
                            return True
                        return False
                    elif sandbox.state not in (SandboxState.ARCHIVING, SandboxState.ARCHIVED):
                        logger.warning(f"Sandbox {sandbox_id} changed to unexpected state: {sandbox.state}")
                        break
                logger.warning(f"Sandbox {sandbox_id} archiving timeout after {TimeoutConfig.STATE_TRANSITION}s")
                return False

            if state == SandboxState.STARTING:
                logger.info(f"Sandbox {sandbox_id} is starting, waiting...")
                await sandbox.wait_for_sandbox_start(timeout=float(TimeoutConfig.STATE_TRANSITION))
                logger.info(f"Sandbox {sandbox_id} started")
                return True

            if state == SandboxState.ERROR:
                recoverable = getattr(sandbox, "recoverable", False)
                if recoverable is not True:
                    logger.warning(f"Sandbox {sandbox_id} is in error state, not recoverable")
                    return False
                logger.info(f"Recovering sandbox {sandbox_id} from error state...")
                await sandbox.recover(timeout=float(TimeoutConfig.STATE_TRANSITION))
                logger.info(f"Sandbox {sandbox_id} recovered successfully")
                return True

            logger.warning(f"Sandbox {sandbox_id} is in unknown state: {state}, attempting start...")
            return await self._start_sandbox(sandbox, sandbox_id)

        except Exception as e:
            logger.warning(f"Failed to ensure sandbox {sandbox_id} is running: {e}")
            return False

    async def _start_sandbox(
        self: DaytonaClientProtocol,
        sandbox: AsyncSandbox,
        sandbox_id: str,
        timeout: float = TimeoutConfig.STATE_TRANSITION,
    ) -> bool:
        """Start *sandbox* and wait for it to become ready."""
        try:
            await sandbox.start(timeout=timeout)
            logger.info(f"Sandbox {sandbox_id} started successfully")
            return True
        except Exception as e:
            logger.warning(f"Failed to start sandbox {sandbox_id}: {e}")
            return False
