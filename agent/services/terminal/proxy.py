"""Terminal reverse-proxy business logic."""

import asyncio
import logging
import re
from dataclasses import dataclass
from typing import Dict, Iterable, Optional
from urllib.parse import ParseResult, urlparse, urlunparse

import httpx
import websockets
from starlette.websockets import WebSocketDisconnect, WebSocketState
from websockets.typing import Subprotocol

from config import DAYTONA_API_KEY
from sandbox import DaytonaClient
from utils.db import get_sandbox_id_for_thread

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Singleton client
# ---------------------------------------------------------------------------

_daytona_client = DaytonaClient()

# ---------------------------------------------------------------------------
# Header filtering
# ---------------------------------------------------------------------------

_HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}

_DROP_RESPONSE_HEADERS = {
    "content-security-policy",
}

_LOOPBACK_PROXY_HOST = "127.0.0.1"


@dataclass(frozen=True)
class PreviewRoute:
    """Resolved routing info for a Daytona preview URL."""

    parsed: ParseResult
    connect_host: str
    connect_port: int
    host_header: str
    loopback_override: bool


def _daytona_api_key() -> str:
    if not DAYTONA_API_KEY:
        raise RuntimeError("Missing env var: daytona_apikey")
    return DAYTONA_API_KEY


def _filter_outgoing_headers(headers: Iterable[tuple[str, str]]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for k, v in headers:
        lk = k.lower()
        if lk in _HOP_BY_HOP_HEADERS:
            continue
        if lk in {"host", "content-length"}:
            continue
        out[k] = v
    return out


def _filter_incoming_headers(headers: Iterable[tuple[str, str]]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for k, v in headers:
        lk = k.lower()
        if lk in _HOP_BY_HOP_HEADERS:
            continue
        if lk in _DROP_RESPONSE_HEADERS:
            continue
        if lk == "content-length":
            continue
        out[k] = v
    return out


# ---------------------------------------------------------------------------
# URL / payload rewriting
# ---------------------------------------------------------------------------

def _rewrite_text_payload(text: str, prefix: str) -> str:
    base = prefix.rstrip("/")
    base_no_slash = re.escape(base.lstrip("/"))

    text = re.sub(
        r'(\b(?:src|href|action)=["\'])/(?!' + base_no_slash + r")",
        r"\1" + base + r"/",
        text,
    )
    text = re.sub(
        r"url\(/(?!" + base_no_slash + r")",
        "url(" + base + "/",
        text,
    )
    return text


def _inject_html_bootstrap(html: str, prefix: str) -> str:
    base_href = prefix.rstrip("/") + "/"
    base_js = base_href.replace("\\", "\\\\").replace("'", "\\'")

    base_tag = f'<base href="{base_href}">'
    style_tag = (
        "<style>"
        "html,body{background:#000 !important;margin:0;height:100%;}"
        "body{overflow:hidden;}"
        ".xterm,.xterm-viewport,.xterm-screen{background:#000 !important;}"
        ".xterm-viewport{scrollbar-color:#1f2937 #000;}"
        ".xterm-viewport::-webkit-scrollbar{width:10px;height:10px;}"
        ".xterm-viewport::-webkit-scrollbar-track{background:#000;}"
        ".xterm-viewport::-webkit-scrollbar-thumb{background:#1f2937;border-radius:8px;}"
        "</style>"
    )
    bootstrap = (
        "<script>(function(){"
        f"var BASE='{base_js}';"
        "var _WS=window.WebSocket;"
        "if(!_WS)return;"
        "function fix(u){"
        "if(typeof u!=='string')return u;"
        "if(u[0]==='/')return BASE+u.slice(1);"
        "var m=u.match(/^(?:wss?|https?):\\/\\/[^/]+\\/(.*)$/);"
        "if(m)return BASE+m[1];"
        "return u;}"
        "window.WebSocket=function(u,p){u=fix(u);return p?new _WS(u,p):new _WS(u);};"
        "window.WebSocket.prototype=_WS.prototype;"
        "})();</script>"
    )

    if "<head" in html:
        return re.sub(
            r"(<head[^>]*>)",
            r"\1" + base_tag + style_tag + bootstrap,
            html,
            count=1,
            flags=re.I,
        )

    return base_tag + style_tag + bootstrap + html


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

async def get_preview_url(session_id: str) -> str:
    """Resolve a session to its Daytona terminal preview URL."""
    sandbox_id = await get_sandbox_id_for_thread(session_id)
    if not sandbox_id:
        raise ValueError("Session has no assigned sandbox")
    return await _daytona_client.get_terminal_url(sandbox_id)


def _should_use_loopback_proxy(hostname: str | None) -> bool:
    return hostname == "proxy.localhost" or (
        hostname is not None and hostname.endswith(".proxy.localhost")
    )


def resolve_preview_route(preview_url: str) -> PreviewRoute:
    """Resolve how the proxy should connect to a preview URL."""
    parsed = urlparse(preview_url)
    if not parsed.hostname:
        raise ValueError(f"Invalid preview URL: {preview_url}")

    loopback_override = _should_use_loopback_proxy(parsed.hostname)
    connect_host = _LOOPBACK_PROXY_HOST if loopback_override else parsed.hostname
    connect_port = parsed.port or (443 if parsed.scheme == "https" else 80)

    return PreviewRoute(
        parsed=parsed,
        connect_host=connect_host,
        connect_port=connect_port,
        host_header=parsed.netloc,
        loopback_override=loopback_override,
    )


def build_upstream_url(
    preview_url: str,
    path: str,
    query: str,
    *,
    connect_host: str | None = None,
    connect_port: int | None = None,
) -> str:
    """Build the upstream URL from a preview base, sub-path, and query string."""
    parsed = urlparse(preview_url)
    upstream_path = path if path and path.startswith("/") else ("/" + path if path else "/")
    netloc = parsed.netloc
    if connect_host is not None:
        port = connect_port or parsed.port
        netloc = f"{connect_host}:{port}" if port is not None else connect_host
    return urlunparse((parsed.scheme, netloc, upstream_path, "", query, ""))


# ---------------------------------------------------------------------------
# HTTP reverse proxy
# ---------------------------------------------------------------------------

class ProxyHttpResult:
    """Holds the data the router needs to build a ``Response``."""

    __slots__ = ("body", "status_code", "headers", "media_type")

    def __init__(self, body: bytes | str, status_code: int, headers: Dict[str, str], media_type: Optional[str]):
        self.body = body
        self.status_code = status_code
        self.headers = headers
        self.media_type = media_type


async def proxy_http_request(
    *,
    method: str,
    preview_url: str,
    path: str,
    query: str,
    raw_headers: Iterable[tuple[str, str]],
    body: bytes,
    router_prefix: str,
    session_id: str,
) -> ProxyHttpResult:
    """Forward an HTTP request to the upstream Daytona terminal and return the result."""
    route = resolve_preview_route(preview_url)
    upstream = build_upstream_url(
        preview_url,
        path,
        query,
        connect_host=route.connect_host if route.loopback_override else None,
        connect_port=route.connect_port if route.loopback_override else None,
    )

    headers = _filter_outgoing_headers(raw_headers)
    headers["Authorization"] = f"Bearer {_daytona_api_key()}"
    headers["Accept-Encoding"] = "identity"
    if route.loopback_override:
        headers["Host"] = route.host_header

    if route.loopback_override:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=60.0,
            trust_env=False,
        ) as client:
            resp = await client.request(method, upstream, headers=headers, content=body if body else None)
    else:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=60.0,
        ) as client:
            resp = await client.request(method, upstream, headers=headers, content=body if body else None)

    response_headers = _filter_incoming_headers(resp.headers.items())
    content_type = resp.headers.get("content-type", "")
    prefix = f"{router_prefix}/{session_id}/terminal"
    media_type = content_type.split(";")[0] if content_type else None

    if "text/html" in content_type:
        rewritten = _rewrite_text_payload(resp.text, prefix=prefix)
        rewritten = _inject_html_bootstrap(rewritten, prefix=prefix)
        return ProxyHttpResult(body=rewritten, status_code=resp.status_code, headers=response_headers, media_type=media_type)

    if "text/css" in content_type:
        rewritten = _rewrite_text_payload(resp.text, prefix=prefix)
        return ProxyHttpResult(body=rewritten, status_code=resp.status_code, headers=response_headers, media_type=media_type)

    return ProxyHttpResult(body=resp.content, status_code=resp.status_code, headers=response_headers, media_type=media_type)


# ---------------------------------------------------------------------------
# WebSocket reverse proxy
# ---------------------------------------------------------------------------

async def proxy_websocket(
    *,
    websocket,  # starlette WebSocket
    preview_url: str,
    path: str,
    query: str,
    session_id: str,
) -> None:
    """Bidirectional WebSocket proxy between client and upstream."""
    route = resolve_preview_route(preview_url)
    parsed = route.parsed
    scheme = "wss" if parsed.scheme == "https" else "ws"
    upstream_path = path if path.startswith("/") else ("/" + path if path else "/")
    upstream_ws = urlunparse((scheme, parsed.netloc, upstream_path, "", query, ""))

    extra_headers = {
        "Authorization": f"Bearer {_daytona_api_key()}",
        "Origin": f"{parsed.scheme}://{parsed.netloc}",
    }

    subprotocol_header = websocket.headers.get("sec-websocket-protocol")
    subprotocols: Optional[list[Subprotocol]] = None
    if subprotocol_header:
        subprotocols = [Subprotocol(p.strip()) for p in subprotocol_header.split(",") if p.strip()]

    async def safe_close(code: int = 1000, reason: str = ""):
        if websocket.application_state == WebSocketState.DISCONNECTED:
            return
        try:
            await websocket.close(code=code, reason=reason)
        except RuntimeError:
            pass

    try:
        if route.loopback_override:
            upstream_connection = websockets.connect(
                upstream_ws,
                additional_headers=extra_headers,
                subprotocols=subprotocols,
                ping_interval=20,
                ping_timeout=20,
                close_timeout=2,
                host=route.connect_host,
                port=route.connect_port,
                proxy=None,
            )
        else:
            upstream_connection = websockets.connect(
                upstream_ws,
                additional_headers=extra_headers,
                subprotocols=subprotocols,
                ping_interval=20,
                ping_timeout=20,
                close_timeout=2,
            )

        async with upstream_connection as upstream:
            async def client_to_upstream():
                try:
                    while True:
                        try:
                            message = await websocket.receive()
                        except WebSocketDisconnect:
                            break
                        if message.get("type") == "websocket.disconnect":
                            break
                        if "text" in message and message["text"] is not None:
                            await upstream.send(message["text"])
                        elif "bytes" in message and message["bytes"] is not None:
                            await upstream.send(message["bytes"])
                finally:
                    await upstream.close()

            async def upstream_to_client():
                try:
                    async for message in upstream:
                        if isinstance(message, (bytes, bytearray)):
                            await websocket.send_bytes(bytes(message))
                        else:
                            await websocket.send_text(str(message))
                finally:
                    await safe_close()

            await asyncio.gather(client_to_upstream(), upstream_to_client())
    except Exception as e:
        logger.error(
            "Terminal WS proxy error: session_id=%s path=%s upstream=%s: %s",
            session_id, path, upstream_ws, e,
        )
        await safe_close(code=1011, reason=str(e)[:120])
