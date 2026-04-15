"""Terminal proxy endpoints (Daytona web terminal)."""

import logging

from fastapi import APIRouter, HTTPException, Request, Response, WebSocket

from schemas.system import TerminalPreviewResponse
from services.terminal import (
    get_preview_url,
    proxy_http_request,
    proxy_websocket,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sandbox", tags=["terminal"])


@router.api_route(
    "/{session_id}/terminal/",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    include_in_schema=False,
)
@router.api_route(
    "/{session_id}/terminal/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    include_in_schema=False,
)
async def get_session_terminal(request: Request, session_id: str, path: str = ""):
    """Reverse proxy for Daytona terminal HTML/assets."""
    try:
        preview_url = await get_preview_url(session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    accept = request.headers.get("accept", "")
    if request.method == "GET" and not path and "application/json" in accept:
        response: TerminalPreviewResponse = {"url": preview_url}
        return response

    body = await request.body()

    result = await proxy_http_request(
        method=request.method,
        preview_url=preview_url,
        path=path,
        query=request.url.query,
        raw_headers=request.headers.items(),
        body=body,
        router_prefix=router.prefix,
        session_id=session_id,
    )

    return Response(
        content=result.body,
        status_code=result.status_code,
        headers=result.headers,
        media_type=result.media_type,
    )


@router.websocket("/{session_id}/terminal/{path:path}")
async def proxy_terminal_ws(websocket: WebSocket, session_id: str, path: str = ""):
    await websocket.accept()

    try:
        preview_url = await get_preview_url(session_id)
    except ValueError:
        await websocket.close(code=1008, reason="Session has no assigned sandbox")
        return

    await proxy_websocket(
        websocket=websocket,
        preview_url=preview_url,
        path=path,
        query=websocket.url.query,
        session_id=session_id,
    )
