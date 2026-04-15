"""Skills business logic — query and manage sandbox skills."""

import logging
import posixpath
from typing import cast

from schemas.skills import SkillPayload
from sandbox import DaytonaClient
from utils.db import get_sandbox_id_for_thread

logger = logging.getLogger(__name__)


class SkillServiceError(ValueError):
    """Base class for expected skill-management failures."""


class SkillSandboxNotFoundError(SkillServiceError):
    """Raised when a thread has no bound sandbox."""


class SkillNotFoundError(SkillServiceError):
    """Raised when a requested skill does not exist in the sandbox manifest."""


class SkillProtectedError(SkillServiceError):
    """Raised when the caller tries to mutate a protected/core skill."""


async def _resolve_sandbox(thread_id: str) -> str:
    """Resolve thread_id to sandbox_id, raising ValueError when missing."""
    sandbox_id = await get_sandbox_id_for_thread(thread_id)
    if not sandbox_id:
        raise SkillSandboxNotFoundError("No session sandbox found for this thread")
    return sandbox_id


def _translate_skill_error(error: ValueError) -> SkillServiceError | ValueError:
    detail = str(error)
    if "core skill" in detail.lower():
        return SkillProtectedError(detail)
    if detail.startswith("Skill ") and detail.endswith(" not found"):
        return SkillNotFoundError(detail)
    return error


async def list_skills(thread_id: str) -> list[SkillPayload]:
    """List all available skills and their status for a thread's sandbox."""
    sandbox_id = await _resolve_sandbox(thread_id)
    client = DaytonaClient()
    skills = await client.list_all_skills_with_details(sandbox_id)
    return cast(list[SkillPayload], skills)


async def install_skill(thread_id: str, skill_name: str) -> None:
    """Enable (install) a skill in the thread's sandbox."""
    sandbox_id = await _resolve_sandbox(thread_id)
    client = DaytonaClient()
    try:
        await client.enable_skill(sandbox_id, skill_name)
    except ValueError as error:
        translated = _translate_skill_error(error)
        raise translated from error


async def uninstall_skill(thread_id: str, skill_name: str) -> None:
    """Disable (uninstall) a skill in the thread's sandbox."""
    sandbox_id = await _resolve_sandbox(thread_id)
    client = DaytonaClient()
    try:
        await client.disable_skill(sandbox_id, skill_name)
    except ValueError as error:
        translated = _translate_skill_error(error)
        raise translated from error


async def upload_skill(thread_id: str, skill_name: str, files: dict[str, bytes]) -> None:
    """Upload a custom skill into the thread's sandbox.

    Args:
        thread_id: The thread whose sandbox receives the skill.
        skill_name: Directory name for the skill.
        files: Mapping of relative path → file content (must include ``SKILL.md``).

    Raises:
        SkillServiceError: If validation fails (empty name, missing SKILL.md).
    """
    if not skill_name:
        raise SkillServiceError("skill_name is required")

    # Ensure at least a SKILL.md is present
    has_skill_md = any(
        posixpath.basename(p).upper() == "SKILL.MD" for p in files
    )
    if not has_skill_md:
        raise SkillServiceError("Uploaded files must include a SKILL.md")

    sandbox_id = await _resolve_sandbox(thread_id)
    client = DaytonaClient()
    await client.upload_custom_skill(sandbox_id, skill_name, files)
