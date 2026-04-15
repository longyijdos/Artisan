"""Shared internal types for sandbox integration layers."""

from __future__ import annotations

from typing import Literal, TypedDict

SkillStatus = Literal["core", "installed", "available"]


class ExecCommandResult(TypedDict):
    exit_code: int
    stdout: str
    stderr: str


class SandboxFileEntry(TypedDict):
    name: str
    is_dir: bool
    size: int
    mod_time: object
    permissions: object


class SandboxFileInfo(TypedDict):
    name: str
    is_dir: bool
    size: int
    mod_time: object
    permissions: object
    mode: object


class SkillManifestEntry(TypedDict, total=False):
    name: str
    status: SkillStatus
    description: str
    is_core: bool


class ActiveSkillDetail(TypedDict):
    name: str
    description: str


class SkillsUploadResponse(TypedDict, total=False):
    success: bool
    skills_dir: str
    message: str
    error: str
