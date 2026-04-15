"""Session management endpoints."""

import logging

from fastapi import APIRouter, HTTPException

from schemas.sessions import (
    SessionAutonameRequest,
    SessionAutonameResponse,
    SessionCreateResponse,
    SessionDeleteResponse,
    SessionListResponse,
    SessionPoolStatsResponse,
    SessionTitleUpdateResponse,
    normalize_autoname_request,
)
from services.sessions import (
    autoname_from_message,
    create_session as _create_session,
    delete_session as _delete_session,
    get_pool_stats as _get_pool_stats,
    list_sessions as _list_sessions,
    update_session_title as _update_session_title,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("")
async def list_sessions() -> SessionListResponse:
    """List all sessions (threads) from the checkpoint database."""
    try:
        sessions = await _list_sessions()
        response: SessionListResponse = {"sessions": sessions}
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error listing sessions")
        raise HTTPException(status_code=500, detail="Failed to list sessions") from e


@router.post("")
async def create_new_session(title: str = "新对话") -> SessionCreateResponse:
    """Create a new session with a sandbox from the pool."""
    try:
        return await _create_session(title)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error creating session")
        raise HTTPException(status_code=500, detail="Failed to create session") from e


@router.delete("/{session_id}")
async def delete_existing_session(session_id: str) -> SessionDeleteResponse:
    """Delete a session and release its sandbox."""
    try:
        await _delete_session(session_id)
        response: SessionDeleteResponse = {"success": True, "id": session_id}
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error deleting session %s", session_id)
        raise HTTPException(status_code=500, detail="Failed to delete session") from e


@router.patch("/{session_id}")
async def update_session_title(session_id: str, title: str) -> SessionTitleUpdateResponse:
    """Update session title."""
    try:
        await _update_session_title(session_id, title)
        response: SessionTitleUpdateResponse = {
            "success": True,
            "id": session_id,
            "title": title,
        }
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error updating session %s", session_id)
        raise HTTPException(status_code=500, detail="Failed to update session") from e


@router.get("/pool/stats")
async def get_pool_stats() -> SessionPoolStatsResponse:
    """Get sandbox pool statistics."""
    try:
        stats = await _get_pool_stats()
        response: SessionPoolStatsResponse = {"stats": stats}
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error getting pool stats")
        raise HTTPException(status_code=500, detail="Failed to get pool stats") from e


@router.post("/autoname")
async def autoname_session(payload: SessionAutonameRequest) -> SessionAutonameResponse:
    """Generate a short title based on the user's first message."""
    try:
        normalized = normalize_autoname_request(payload)
        title = await autoname_from_message(normalized.message)
        response: SessionAutonameResponse = {"title": title}
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error auto-naming session")
        raise HTTPException(status_code=500, detail="Failed to auto-name session") from e
