"""Workspace file operation endpoints."""

import logging
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from schemas.workspace import (
    WorkspaceDeleteResponse,
    WorkspaceFileItemPayload,
    WorkspaceMkdirResponse,
    WorkspaceReadResponse,
    WorkspaceRenameResponse,
    WorkspaceStatusResponse,
    WorkspaceUploadResponse,
)
from services.workspace import (
    create_folder as _create_folder,
    delete_file as _delete_file,
    download_file as _download_file,
    get_workspace_status as _get_workspace_status,
    list_files as _list_files,
    read_file as _read_file,
    rename_file as _rename_file,
    upload_file as _upload_file,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workspace", tags=["workspace"])


@router.get("")
async def get_workspace_status(thread_id: Optional[str] = None):
    """Get workspace status."""
    try:
        response: WorkspaceStatusResponse = await _get_workspace_status(thread_id)
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error getting workspace status")
        raise HTTPException(status_code=500, detail="Failed to get workspace status") from e


@router.get("/files")
async def list_workspace_files(path: str = ".", thread_id: Optional[str] = None):
    """List files in the workspace."""
    try:
        response: list[WorkspaceFileItemPayload] = await _list_files(path, thread_id)
        return response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Error listing workspace files")
        raise HTTPException(status_code=500, detail="Failed to list workspace files") from e


@router.get("/read")
async def read_workspace_file(path: str, thread_id: Optional[str] = None):
    """Read a file from the workspace."""
    try:
        response: WorkspaceReadResponse = await _read_file(path, thread_id)
        return response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Error reading file: %s", path)
        raise HTTPException(status_code=500, detail="Failed to read file") from e


@router.post("/upload")
async def upload_workspace_file(file: UploadFile = File(...), path: str = "", thread_id: Optional[str] = None):
    """Upload a file to the workspace."""
    try:
        contents = await file.read()
        filename = file.filename or "upload"
        response: WorkspaceUploadResponse = await _upload_file(filename, contents, path, thread_id)
        return response
    except HTTPException:
        raise
    except ValueError as e:
        status = 413 if "too large" in str(e).lower() else 400
        raise HTTPException(status_code=status, detail=str(e))
    except Exception as e:
        logger.exception("Error uploading file")
        raise HTTPException(status_code=500, detail="Failed to upload file") from e


@router.delete("/delete")
async def delete_workspace_file(path: str, thread_id: Optional[str] = None):
    """Delete a file or directory from the workspace."""
    try:
        response: WorkspaceDeleteResponse = await _delete_file(path, thread_id)
        return response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Error deleting file: %s", path)
        raise HTTPException(status_code=500, detail="Failed to delete file") from e


@router.post("/rename")
async def rename_workspace_file(old_path: str, new_path: str, thread_id: Optional[str] = None):
    """Rename a file or directory in the workspace."""
    try:
        response: WorkspaceRenameResponse = await _rename_file(old_path, new_path, thread_id)
        return response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Error renaming file: %s -> %s", old_path, new_path)
        raise HTTPException(status_code=500, detail="Failed to rename file") from e


@router.post("/mkdir")
async def create_workspace_folder(path: str, thread_id: Optional[str] = None):
    """Create a new folder in the workspace."""
    try:
        response: WorkspaceMkdirResponse = await _create_folder(path, thread_id)
        return response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Error creating folder: %s", path)
        raise HTTPException(status_code=500, detail="Failed to create folder") from e


@router.get("/download")
async def download_workspace_file(path: str, thread_id: Optional[str] = None):
    """Download a file from the workspace."""
    try:
        result = await _download_file(path, thread_id)
        return StreamingResponse(
            result.iter_content,
            media_type=result.content_type,
            headers={
                "Content-Disposition": (
                    f'attachment; filename="{result.ascii_filename}"; '
                    f"filename*=UTF-8''{result.encoded_filename}"
                ),
                "Content-Length": str(result.file_size),
                "Accept-Ranges": "bytes",
            },
        )
    except HTTPException:
        raise
    except ValueError as e:
        status = 400
        raise HTTPException(status_code=status, detail=str(e))
    except Exception as e:
        logger.exception("Error downloading file: %s", path)
        raise HTTPException(status_code=500, detail="Failed to download file") from e
