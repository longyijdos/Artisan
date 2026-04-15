"""Contracts for workspace-related HTTP payloads."""

from typing import TypedDict


class WorkspaceFileItemPayload(TypedDict, total=False):
    name: str
    is_dir: bool
    size: int


class WorkspaceStatusResponse(TypedDict):
    path: str
    initialized: bool
    file_count: int


class WorkspaceReadResponse(TypedDict):
    content: str
    path: str


class WorkspaceUploadResponse(TypedDict):
    message: str
    filename: str
    path: str


class WorkspaceDeleteResponse(TypedDict):
    message: str
    path: str


class WorkspaceRenameResponse(TypedDict):
    message: str
    old_path: str
    new_path: str


class WorkspaceMkdirResponse(TypedDict):
    message: str
    path: str
