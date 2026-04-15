"""Internal protocol types for sandbox mixins."""

from __future__ import annotations

from typing import Protocol

from daytona import AsyncDaytona, AsyncSandbox

from ._types import SandboxFileEntry, SandboxFileInfo, SkillManifestEntry, SkillStatus


class DaytonaClientProtocol(Protocol):
    """Structural type implemented by ``DaytonaClient`` for mixin self annotations."""

    client: AsyncDaytona
    default_snapshot: str | None
    skills_local_dir: str

    async def get_sandbox(
        self,
        sandbox_id: str,
        ensure_running: bool = True,
    ) -> AsyncSandbox: ...

    async def get_working_directory(self, sandbox_id: str) -> str: ...

    async def validate_read_path(
        self,
        sandbox_id: str,
        path: str,
        allow_skills: bool = True,
    ) -> str: ...

    async def validate_write_path(self, sandbox_id: str, path: str) -> str: ...

    async def file_exists(self, sandbox_id: str, path: str) -> bool: ...

    async def directory_exists(self, sandbox_id: str, path: str) -> bool: ...

    async def get_file_info(self, sandbox_id: str, path: str) -> SandboxFileInfo: ...

    async def list_files(self, sandbox_id: str, path: str) -> list[SandboxFileEntry]: ...

    async def get_skills_directory(self, sandbox_id: str = "") -> str: ...

    async def list_all_skills_with_details(self, sandbox_id: str) -> list[SkillManifestEntry]: ...

    async def _skills_json_path(self, sandbox: AsyncSandbox) -> str: ...

    async def _upload_skills(self, sandbox: AsyncSandbox, sandbox_id: str) -> None: ...

    async def _init_skills_manifest(self, sandbox: AsyncSandbox, sandbox_id: str) -> None: ...

    async def _ensure_running(self, sandbox: AsyncSandbox, sandbox_id: str) -> bool: ...

    async def _start_sandbox(
        self,
        sandbox: AsyncSandbox,
        sandbox_id: str,
        timeout: float = ...,
    ) -> bool: ...

    async def _is_core_skill(self, sandbox_id: str, skill_name: str) -> bool: ...

    async def _update_skill_status(
        self,
        sandbox_id: str,
        skill_name: str,
        new_status: SkillStatus,
    ) -> None: ...
