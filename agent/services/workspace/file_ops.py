"""Workspace file operation business logic."""

import logging
import mimetypes
from collections.abc import Iterator
from typing import cast
from urllib.parse import quote

from config import MAX_UPLOAD_SIZE
from sandbox import DaytonaClient
from schemas.workspace import (
    WorkspaceDeleteResponse,
    WorkspaceFileItemPayload,
    WorkspaceMkdirResponse,
    WorkspaceReadResponse,
    WorkspaceRenameResponse,
    WorkspaceStatusResponse,
    WorkspaceUploadResponse,
)
from utils.db import get_sandbox_id_for_thread

logger = logging.getLogger(__name__)


def _ascii_filename_fallback(filename: str) -> str:
    """Build an ASCII-safe fallback filename for HTTP headers."""
    safe_chars = []
    for ch in filename:
        code = ord(ch)
        if 32 <= code <= 126 and ch not in {'"', "\\"}:
            safe_chars.append(ch)
        else:
            safe_chars.append("_")
    fallback = "".join(safe_chars).strip(" .")
    return fallback or "download"


async def _resolve_sandbox(thread_id: str | None) -> str:
    """Resolve thread_id to sandbox_id, raising ValueError when missing."""
    if not isinstance(thread_id, str) or not thread_id.strip():
        raise ValueError("Missing or invalid thread_id")

    sandbox_id = await get_sandbox_id_for_thread(thread_id)
    if not sandbox_id:
        raise ValueError("Missing or invalid thread_id")
    return sandbox_id


async def get_workspace_status(thread_id: str | None) -> WorkspaceStatusResponse:
    """Return workspace path, initialization flag, and file count."""
    if not isinstance(thread_id, str) or not thread_id.strip():
        return {"path": "", "initialized": False, "file_count": 0}

    sandbox_id = await get_sandbox_id_for_thread(thread_id)
    if not sandbox_id:
        return {"path": "", "initialized": False, "file_count": 0}

    client = DaytonaClient()
    await client.create_sandbox(sandbox_id)
    files = await client.list_files(sandbox_id, ".")
    return {
        "path": await client.get_working_directory(sandbox_id),
        "initialized": True,
        "file_count": len(files),
    }


async def list_files(path: str, thread_id: str | None) -> list[WorkspaceFileItemPayload]:
    """List files in a workspace directory, sorted dirs-first."""
    sandbox_id = await _resolve_sandbox(thread_id)

    client = DaytonaClient()
    if not path:
        path = "."
    files = await client.list_files(sandbox_id, path)
    files.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
    return cast(list[WorkspaceFileItemPayload], files)


async def read_file(path: str, thread_id: str | None) -> WorkspaceReadResponse:
    """Read a single file and return its content."""
    sandbox_id = await _resolve_sandbox(thread_id)

    client = DaytonaClient()
    content = await client.read_file(sandbox_id, path)
    return {"content": content, "path": path}


async def upload_file(
    filename: str,
    contents: bytes,
    path: str,
    thread_id: str | None,
) -> WorkspaceUploadResponse:
    """Write uploaded file contents into the workspace."""
    sandbox_id = await _resolve_sandbox(thread_id)

    if len(contents) > MAX_UPLOAD_SIZE:
        raise ValueError(
            f"File too large. Max size is {MAX_UPLOAD_SIZE // (1024 * 1024)} MB"
        )

    client = DaytonaClient()
    full_path = f"{path}/{filename}" if path else filename
    if full_path.startswith("/"):
        full_path = full_path[1:]

    await client.write_file(sandbox_id, full_path, contents)
    return {"message": f"Successfully uploaded {filename}", "filename": filename, "path": full_path}


async def delete_file(path: str, thread_id: str | None) -> WorkspaceDeleteResponse:
    """Delete a file or directory from the workspace."""
    sandbox_id = await _resolve_sandbox(thread_id)

    client = DaytonaClient()
    try:
        file_info = await client.get_file_info(sandbox_id, path)
        is_dir = file_info.get("is_dir", False)
    except Exception:
        is_dir = False

    await client.delete_file(sandbox_id, path, recursive=is_dir)
    return {"message": f"Successfully deleted {path}", "path": path}


async def rename_file(
    old_path: str, new_path: str, thread_id: str | None
) -> WorkspaceRenameResponse:
    """Rename / move a file or directory."""
    sandbox_id = await _resolve_sandbox(thread_id)

    client = DaytonaClient()
    work_dir = await client.get_working_directory(sandbox_id)
    sandbox = await client.get_sandbox(sandbox_id)

    old_full = f"{work_dir}/{old_path}" if not old_path.startswith("/") else old_path
    new_full = f"{work_dir}/{new_path}" if not new_path.startswith("/") else new_path

    await sandbox.fs.move_files(old_full, new_full)
    return {
        "message": f"Successfully renamed {old_path} to {new_path}",
        "old_path": old_path,
        "new_path": new_path,
    }


async def create_folder(path: str, thread_id: str | None) -> WorkspaceMkdirResponse:
    """Create a new directory in the workspace."""
    sandbox_id = await _resolve_sandbox(thread_id)

    client = DaytonaClient()
    work_dir = await client.get_working_directory(sandbox_id)
    sandbox = await client.get_sandbox(sandbox_id)

    full_path = f"{work_dir}/{path}" if not path.startswith("/") else path
    await sandbox.fs.create_folder(full_path, "755")
    return {"message": f"Successfully created folder {path}", "path": path}


class DownloadResult:
    """Holds everything the router needs to build a StreamingResponse."""

    __slots__ = ("content_type", "filename", "ascii_filename", "encoded_filename", "file_size", "iter_content")

    def __init__(
        self,
        content_type: str,
        filename: str,
        ascii_filename: str,
        encoded_filename: str,
        file_size: int,
        iter_content: Iterator[bytes],
    ):
        self.content_type = content_type
        self.filename = filename
        self.ascii_filename = ascii_filename
        self.encoded_filename = encoded_filename
        self.file_size = file_size
        self.iter_content = iter_content


async def download_file(path: str, thread_id: str | None) -> DownloadResult:
    """Prepare a file download (content iterator + metadata)."""
    sandbox_id = await _resolve_sandbox(thread_id)

    client = DaytonaClient()
    work_dir = await client.get_working_directory(sandbox_id)

    file_path = path if path.startswith("/") else f"{work_dir}/{path}"

    sandbox = await client.get_sandbox(sandbox_id)
    file_info = await sandbox.fs.get_file_info(file_path)

    if file_info.is_dir:
        raise ValueError("Cannot download a directory")

    file_size = file_info.size
    content = await sandbox.fs.download_file(file_path)

    filename = path.split("/")[-1]
    content_type, _ = mimetypes.guess_type(filename)
    if not content_type:
        content_type = "application/octet-stream"

    def iter_content():
        chunk_size = 64 * 1024
        for i in range(0, len(content), chunk_size):
            yield content[i : i + chunk_size]

    return DownloadResult(
        content_type=content_type,
        filename=filename,
        ascii_filename=_ascii_filename_fallback(filename),
        encoded_filename=quote(filename),
        file_size=file_size,
        iter_content=iter_content(),
    )
