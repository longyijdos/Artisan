"""Skills management mixin for DaytonaClient."""

from __future__ import annotations

import json
import logging
import os
import posixpath
from pathlib import Path
from typing import TypeGuard

import yaml
from daytona import AsyncSandbox, FileUpload

from sandbox._types import (
    ActiveSkillDetail,
    SandboxFileEntry,
    SkillManifestEntry,
    SkillStatus,
    SkillsUploadResponse,
)
from utils.skills import extract_skill_description

from ._constants import PathConfig
from ._protocols import DaytonaClientProtocol

logger = logging.getLogger(__name__)


def _is_skill_status(value: object) -> TypeGuard[SkillStatus]:
    return isinstance(value, str) and value in {"core", "installed", "available"}


def _normalize_skill_manifest(raw_manifest: object) -> list[SkillManifestEntry]:
    if not isinstance(raw_manifest, list):
        return []

    normalized: list[SkillManifestEntry] = []
    for item in raw_manifest:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        if not isinstance(name, str) or not name.strip():
            continue
        status = item.get("status")
        description = item.get("description")
        entry: SkillManifestEntry = {"name": name}
        if _is_skill_status(status):
            entry["status"] = status
        if isinstance(description, str):
            entry["description"] = description
        if isinstance(item.get("is_core"), bool):
            entry["is_core"] = item["is_core"]
        normalized.append(entry)
    return normalized


def _normalize_core_skills(raw_data: object) -> set[str]:
    if not isinstance(raw_data, dict):
        return set()
    raw_skills = raw_data.get("core_skills")
    if not isinstance(raw_skills, list):
        return set()
    return {skill for skill in raw_skills if isinstance(skill, str) and skill.strip()}


class DaytonaSkillsMixin:
    """Upload, enable, disable, and query skills inside a sandbox."""

    # -- public API --------------------------------------------------------

    async def upload_skills_to_sandbox(
        self: DaytonaClientProtocol, sandbox_id: str
    ) -> SkillsUploadResponse:
        """Manually upload skills to an existing sandbox."""
        sandbox = await self.get_sandbox(sandbox_id)
        skills_dir = await self.get_skills_directory(sandbox_id)

        try:
            await self._upload_skills(sandbox, sandbox_id)
            return {
                "success": True,
                "skills_dir": skills_dir,
                "message": f"Skills uploaded to {skills_dir}",
            }
        except Exception as e:
            logger.error(f"Failed to upload skills: {e}")
            return {"success": False, "error": str(e)}

    async def get_skills_directory(self: DaytonaClientProtocol, sandbox_id: str = "") -> str:
        """Return the absolute skills directory path (``/home/daytona/skills``)."""
        home_dir = "/home/daytona"
        if sandbox_id:
            try:
                sandbox = await self.get_sandbox(sandbox_id, ensure_running=False)
                home_dir = await sandbox.get_work_dir() or "/home/daytona"
            except Exception:
                pass
        return posixpath.join(home_dir, PathConfig.SKILLS_DIR)

    async def get_active_skills(self: DaytonaClientProtocol, sandbox_id: str) -> list[str]:
        """Return names of enabled (``installed`` / ``core``) skills."""
        try:
            sandbox = await self.get_sandbox(sandbox_id)
            skills_json_path = await self._skills_json_path(sandbox)

            if not await self.file_exists(sandbox_id, skills_json_path):
                return []

            content = (await sandbox.fs.download_file(skills_json_path)).decode("utf-8")
            skills = _normalize_skill_manifest(json.loads(content))
            return [
                skill["name"]
                for skill in skills
                if skill.get("status") in ("installed", "core")
            ]
        except Exception as e:
            logger.warning(f"Failed to get active skills for {sandbox_id}: {e}")
            return []

    async def list_all_skills_with_details(
        self: DaytonaClientProtocol, sandbox_id: str
    ) -> list[SkillManifestEntry]:
        """Return the full skills list from ``skills.json``."""
        try:
            sandbox = await self.get_sandbox(sandbox_id)
            skills_json_path = await self._skills_json_path(sandbox)

            if not await self.file_exists(sandbox_id, skills_json_path):
                logger.warning(f"skills.json missing for {sandbox_id}, attempting to re-init...")
                await self._init_skills_manifest(sandbox, sandbox_id)
                if not await self.file_exists(sandbox_id, skills_json_path):
                    return []

            content = (await sandbox.fs.download_file(skills_json_path)).decode("utf-8")
            return _normalize_skill_manifest(json.loads(content))
        except Exception as e:
            logger.error(f"Failed to list skills for {sandbox_id}: {e}")
            return []

    async def get_active_skills_with_details(
        self: DaytonaClientProtocol, sandbox_id: str
    ) -> list[ActiveSkillDetail]:
        """Return name + description for every enabled skill (for system prompt)."""
        try:
            sandbox = await self.get_sandbox(sandbox_id)
            skills_json_path = await self._skills_json_path(sandbox)

            if not await self.file_exists(sandbox_id, skills_json_path):
                return []

            content = (await sandbox.fs.download_file(skills_json_path)).decode("utf-8")
            skills = _normalize_skill_manifest(json.loads(content))

            active_details: list[ActiveSkillDetail] = [
                {
                    "name": skill["name"],
                    "description": skill.get("description", ""),
                }
                for skill in skills
                if skill.get("status") in ("installed", "core")
            ]
            return sorted(active_details, key=lambda x: x["name"])
        except Exception as e:
            logger.warning(f"Failed to get active skills details for {sandbox_id}: {e}")
            return []

    async def enable_skill(self: DaytonaClientProtocol, sandbox_id: str, skill_name: str) -> None:
        """Enable a skill (set ``status = "installed"``)."""
        await self._update_skill_status(sandbox_id, skill_name, "installed")

    async def disable_skill(self: DaytonaClientProtocol, sandbox_id: str, skill_name: str) -> None:
        """Disable a skill (set ``status = "available"``).

        Raises:
            ValueError: If the skill is a core skill.
        """
        if await self._is_core_skill(sandbox_id, skill_name):
            raise ValueError(f"Cannot disable core skill: {skill_name}")
        await self._update_skill_status(sandbox_id, skill_name, "available")

    async def upload_custom_skill(
        self: DaytonaClientProtocol,
        sandbox_id: str,
        skill_name: str,
        files: dict[str, bytes],
    ) -> None:
        """Upload a custom skill (files from memory) into the sandbox.

        Args:
            sandbox_id: Target sandbox identifier.
            skill_name: Directory name for the skill under ``/home/daytona/skills/``.
            files: Mapping of relative path → file content (bytes).
        """
        sandbox = await self.get_sandbox(sandbox_id)
        skills_dir = await self.get_skills_directory(sandbox_id)
        skill_dir = posixpath.join(skills_dir, skill_name)

        # Ensure the skill directory exists
        try:
            await sandbox.fs.create_folder(skill_dir, mode="755")
        except Exception as e:
            logger.warning(f"Could not create skill directory {skill_dir}: {e}")

        # Upload each file
        for relative_path, content in files.items():
            remote_path = posixpath.join(skill_dir, relative_path)
            # Ensure parent directories exist
            parent = posixpath.dirname(remote_path)
            if parent != skill_dir:
                try:
                    await sandbox.fs.create_folder(parent, mode="755")
                except Exception:
                    pass
            await sandbox.fs.upload_file(content, remote_path)

        logger.info(
            f"Uploaded custom skill '{skill_name}' ({len(files)} files) to sandbox {sandbox_id}"
        )

        # Refresh manifest so the new skill appears in the list
        await self._init_skills_manifest(sandbox, sandbox_id)

        # Auto-install the newly uploaded skill
        await self._update_skill_status(sandbox_id, skill_name, "installed")

    # -- internal helpers --------------------------------------------------

    async def _skills_json_path(self: DaytonaClientProtocol, sandbox: AsyncSandbox) -> str:
        """Resolve the absolute path to ``skills.json``."""
        home_dir = await sandbox.get_work_dir() or "/home/daytona"
        return posixpath.join(home_dir, PathConfig.CONFIG_DIR, PathConfig.SKILLS_MANIFEST_FILE)

    async def _upload_skills(
        self: DaytonaClientProtocol,
        sandbox: AsyncSandbox,
        sandbox_id: str,
    ) -> None:
        """Upload the local skills directory tree into the sandbox."""
        if not os.path.isdir(self.skills_local_dir):
            logger.warning(f"Skills directory not found: {self.skills_local_dir}")
            return

        skills_dir = await self.get_skills_directory(sandbox_id)

        if not await self.directory_exists(sandbox_id, skills_dir):
            try:
                await sandbox.fs.create_folder(skills_dir, mode="755")
                logger.info(f"Created skills directory: {skills_dir}")
            except Exception as e:
                logger.warning(f"Could not create skills directory: {e}")

        try:
            files_to_upload: list[FileUpload] = []
            skills_path = Path(self.skills_local_dir)

            for file_path in skills_path.rglob("*"):
                if file_path.is_file():
                    relative_path = file_path.relative_to(skills_path)
                    remote_path = posixpath.join(skills_dir, str(relative_path))
                    files_to_upload.append(
                        FileUpload(source=str(file_path), destination=remote_path)
                    )

            if files_to_upload:
                await sandbox.fs.upload_files(files_to_upload)
                logger.info(f"Uploaded {len(files_to_upload)} skill files to sandbox {sandbox_id}")
            else:
                logger.info("No skill files to upload")

            await self._init_skills_manifest(sandbox, sandbox_id)
        except Exception as e:
            logger.error(f"Failed to upload skills to sandbox {sandbox_id}: {e}")

    async def _init_skills_manifest(
        self: DaytonaClientProtocol,
        sandbox: AsyncSandbox,
        sandbox_id: str,
    ) -> None:
        """Initialise or refresh ``skills.json``."""
        try:
            skills_dir = await self.get_skills_directory(sandbox_id)
            core_skills_path = posixpath.join(skills_dir, PathConfig.CORE_SKILLS_FILE)
            home_dir = await sandbox.get_work_dir() or "/home/daytona"
            config_dir = posixpath.join(home_dir, PathConfig.CONFIG_DIR)
            skills_json_path = posixpath.join(config_dir, PathConfig.SKILLS_MANIFEST_FILE)

            await sandbox.fs.create_folder(config_dir, mode="755")

            core_skills: set[str] = set()
            if await self.file_exists(sandbox_id, core_skills_path):
                try:
                    content = (await sandbox.fs.download_file(core_skills_path)).decode("utf-8")
                    core_skills = _normalize_core_skills(yaml.safe_load(content))
                except Exception as e:
                    logger.warning(f"Failed to load core_skills.yaml: {e}")

            existing_skills_map: dict[str, SkillManifestEntry] = {}
            if await self.file_exists(sandbox_id, skills_json_path):
                try:
                    content = (await sandbox.fs.download_file(skills_json_path)).decode("utf-8")
                    for skill in _normalize_skill_manifest(json.loads(content)):
                        existing_skills_map[skill["name"]] = skill
                except Exception as e:
                    logger.warning(f"Failed to read existing skills.json: {e}")

            new_skills_list: list[SkillManifestEntry] = []

            try:
                folders: list[SandboxFileEntry] = await self.list_files(sandbox_id, skills_dir)
            except Exception:
                folders = []

            for folder in folders:
                if not folder["is_dir"]:
                    continue

                name = folder["name"]

                description = ""
                try:
                    skill_md_path = posixpath.join(skills_dir, name, "SKILL.md")
                    content = (await sandbox.fs.download_file(skill_md_path)).decode("utf-8")
                    description = extract_skill_description(content)
                except Exception:
                    pass

                status: SkillStatus = "available"
                is_core = name in core_skills

                if is_core:
                    status = "core"
                elif name in existing_skills_map:
                    old_status = existing_skills_map[name].get("status", "available")
                    if old_status == "core" and not is_core:
                        status = "available"
                    elif old_status == "installed":
                        status = "installed"
                    else:
                        status = "available"

                new_skills_list.append({
                    "name": name,
                    "status": status,
                    "description": description,
                    "is_core": is_core,
                })

            await sandbox.fs.upload_file(
                json.dumps(new_skills_list, indent=2).encode("utf-8"),
                skills_json_path,
            )
            logger.info(f"Initialized skills.json for {sandbox_id} with {len(new_skills_list)} skills")
        except Exception as e:
            logger.error(f"Failed to init skills manifest for {sandbox_id}: {e}")

    async def _is_core_skill(self: DaytonaClientProtocol, sandbox_id: str, skill_name: str) -> bool:
        """Check whether *skill_name* is a core skill."""
        try:
            skills = await self.list_all_skills_with_details(sandbox_id)
            for s in skills:
                if s["name"] == skill_name:
                    return s.get("status") == "core" or s.get("is_core") is True
            return False
        except Exception:
            return False

    async def _update_skill_status(
        self: DaytonaClientProtocol, sandbox_id: str, skill_name: str, new_status: SkillStatus
    ) -> None:
        """Update the status of a single skill in ``skills.json``."""
        try:
            sandbox = await self.get_sandbox(sandbox_id)
            skills_json_path = await self._skills_json_path(sandbox)

            if not await self.file_exists(sandbox_id, skills_json_path):
                raise RuntimeError("skills.json not found")

            content = (await sandbox.fs.download_file(skills_json_path)).decode("utf-8")
            skills = _normalize_skill_manifest(json.loads(content))

            found = False
            for skill in skills:
                if skill["name"] == skill_name:
                    if skill.get("status") == "core":
                        return
                    skill["status"] = new_status
                    found = True
                    break

            if not found:
                raise ValueError(f"Skill {skill_name} not found")

            await sandbox.fs.upload_file(
                json.dumps(skills, indent=2).encode("utf-8"), skills_json_path
            )
        except Exception as e:
            logger.error(f"Failed to update skill status for {sandbox_id}: {e}")
            raise
