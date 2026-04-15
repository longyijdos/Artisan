"""File-system operations mixin for DaytonaClient."""

from __future__ import annotations

import logging
import posixpath

from sandbox._types import SandboxFileEntry, SandboxFileInfo

from ._constants import PathConfig
from ._protocols import DaytonaClientProtocol

logger = logging.getLogger(__name__)


class DaytonaFileOpsMixin:
    """Read / write / list / delete files and directories inside a sandbox.

    Also contains path-validation and working-directory helpers.
    """

    # -- path helpers ------------------------------------------------------

    async def get_working_directory(self: DaytonaClientProtocol, sandbox_id: str) -> str:
        """Return ``{sandbox_work_dir}/workspace``."""
        try:
            sandbox = await self.get_sandbox(sandbox_id)
            base = await sandbox.get_work_dir()
        except Exception as e:
            logger.warning(f"Failed to get work dir from sandbox: {e}")
            base = "/home/daytona"
        return posixpath.join(base, PathConfig.WORKSPACE_DIR)

    async def validate_read_path(
        self: DaytonaClientProtocol,
        sandbox_id: str,
        path: str,
        allow_skills: bool = True,
    ) -> str:
        """Resolve and validate a read path."""
        if not path:
            raise ValueError("Path cannot be empty")

        work_dir = await self.get_working_directory(sandbox_id)

        if posixpath.isabs(path):
            return posixpath.normpath(path)
        return posixpath.normpath(posixpath.join(work_dir, path))

    async def validate_write_path(self: DaytonaClientProtocol, sandbox_id: str, path: str) -> str:
        """Resolve and validate a write path."""
        if not path:
            raise ValueError("Path cannot be empty")

        work_dir = await self.get_working_directory(sandbox_id)

        if posixpath.isabs(path):
            return posixpath.normpath(path)
        return posixpath.normpath(posixpath.join(work_dir, path))

    # -- CRUD --------------------------------------------------------------

    async def write_file(
        self: DaytonaClientProtocol,
        sandbox_id: str,
        path: str,
        content: str | bytes,
    ) -> None:
        """Write *content* to *path* inside the sandbox."""
        safe_path = await self.validate_write_path(sandbox_id, path)
        content_bytes = content.encode("utf-8") if isinstance(content, str) else content
        sandbox = await self.get_sandbox(sandbox_id)
        await sandbox.fs.upload_file(content_bytes, safe_path)

    async def read_file(self: DaytonaClientProtocol, sandbox_id: str, path: str) -> str:
        """Read file content as UTF-8."""
        safe_path = await self.validate_read_path(sandbox_id, path)
        sandbox = await self.get_sandbox(sandbox_id)
        content_bytes = await sandbox.fs.download_file(safe_path)
        try:
            return content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            # Preserve flow for callers; binary-like payload will be detected by upper layers.
            return content_bytes.decode("utf-8", errors="replace")

    async def list_files(
        self: DaytonaClientProtocol,
        sandbox_id: str,
        path: str,
    ) -> list[SandboxFileEntry]:
        """List directory entries."""
        safe_path = await self.validate_read_path(sandbox_id, path)
        sandbox = await self.get_sandbox(sandbox_id)
        files = await sandbox.fs.list_files(path=safe_path)
        return [
            {
                "name": f.name,
                "is_dir": f.is_dir,
                "size": f.size,
                "mod_time": f.mod_time,
                "permissions": f.permissions,
            }
            for f in files
        ]

    async def create_directory(
        self: DaytonaClientProtocol, sandbox_id: str, path: str, mode: str = "755"
    ) -> None:
        """Create a directory."""
        safe_path = await self.validate_write_path(sandbox_id, path)
        sandbox = await self.get_sandbox(sandbox_id)
        await sandbox.fs.create_folder(path=safe_path, mode=mode)

    async def delete_file(
        self: DaytonaClientProtocol, sandbox_id: str, path: str, recursive: bool = False
    ) -> None:
        """Delete a file or directory."""
        safe_path = await self.validate_write_path(sandbox_id, path)
        sandbox = await self.get_sandbox(sandbox_id)
        await sandbox.fs.delete_file(path=safe_path, recursive=recursive)

    async def get_file_info(
        self: DaytonaClientProtocol,
        sandbox_id: str,
        path: str,
    ) -> SandboxFileInfo:
        """Return metadata for a single file or directory."""
        safe_path = await self.validate_read_path(sandbox_id, path)
        sandbox = await self.get_sandbox(sandbox_id)
        info = await sandbox.fs.get_file_info(path=safe_path)
        return {
            "name": info.name,
            "is_dir": info.is_dir,
            "size": info.size,
            "mod_time": info.mod_time,
            "permissions": info.permissions,
            "mode": info.mode,
        }

    async def file_exists(self: DaytonaClientProtocol, sandbox_id: str, path: str) -> bool:
        """Return ``True`` if the path exists."""
        try:
            await self.get_file_info(sandbox_id, path)
            return True
        except Exception:
            return False

    async def directory_exists(self: DaytonaClientProtocol, sandbox_id: str, path: str) -> bool:
        """Return ``True`` if the path exists and is a directory."""
        try:
            info = await self.get_file_info(sandbox_id, path)
            return info["is_dir"]
        except Exception:
            return False
