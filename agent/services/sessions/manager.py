"""Session business logic — DB operations, sandbox pool, LLM auto-naming."""

import logging
import uuid
from typing import Optional, Protocol, cast

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from config import LLM_LITE_MODEL, OPENAI_API_BASE, OPENAI_API_KEY
from schemas.sessions import SessionCreateResponse, SessionPayload, SessionPoolStats
from utils.db import ensure_session_metadata_table, get_db_connection, get_sandbox_id_for_thread
from utils.runtime import get_compiled_graph, get_sandbox_pool, require_sandbox_pool

logger = logging.getLogger(__name__)


class ThreadCheckpointDeleter(Protocol):
    async def adelete_thread(self, thread_id: str) -> object: ...


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

async def list_sessions() -> list[SessionPayload]:
    """List all sessions ordered by last update time."""
    await ensure_session_metadata_table()
    pool = await get_db_connection()

    async with pool.connection() as conn:
        result = await conn.execute("""
            SELECT
                m.thread_id,
                m.title,
                m.created_at,
                m.updated_at
            FROM session_metadata m
            ORDER BY m.updated_at DESC
        """)
        rows = await result.fetchall()

    return [
        {
            "id": row[0],
            "title": row[1],
            "createdAt": row[2].timestamp() if row[2] else None,
            "lastUpdateTime": row[3].timestamp() if row[3] else None,
        }
        for row in rows
    ]


async def create_session(title: str = "新对话") -> SessionCreateResponse:
    """Create a new session with a sandbox from the pool."""
    await ensure_session_metadata_table()
    pool = await get_db_connection()
    sandbox_pool = require_sandbox_pool()

    session_id = str(uuid.uuid4())
    sandbox_id = await sandbox_pool.acquire(session_id)

    async with pool.connection() as conn:
        await conn.execute(
            """
            INSERT INTO session_metadata (thread_id, title, sandbox_id, created_at, updated_at)
            VALUES (%s, %s, %s, NOW(), NOW())
            """,
            (session_id, title, sandbox_id),
        )

    return {"id": session_id, "title": title, "lastUpdateTime": None}


async def delete_session(session_id: str) -> None:
    """Delete a session, its checkpoints, and release its sandbox."""
    compiled_graph = get_compiled_graph()

    if compiled_graph:
        checkpointer = compiled_graph.checkpointer
        if checkpointer and not isinstance(checkpointer, bool):
            typed_checkpointer = cast(ThreadCheckpointDeleter, checkpointer)
            await typed_checkpointer.adelete_thread(session_id)

    pool = await get_db_connection()
    sandbox_id = await get_sandbox_id_for_thread(session_id)
    sandbox_pool = get_sandbox_pool()

    await ensure_session_metadata_table()
    async with pool.connection() as conn:
        await conn.execute(
            "DELETE FROM session_metadata WHERE thread_id = %s",
            (session_id,),
        )

    if sandbox_id and sandbox_pool is not None:
        await sandbox_pool.release(sandbox_id)


async def update_session_title(session_id: str, title: str) -> None:
    """Upsert session title."""
    await ensure_session_metadata_table()
    pool = await get_db_connection()

    async with pool.connection() as conn:
        await conn.execute(
            """
            INSERT INTO session_metadata (thread_id, title, updated_at)
            VALUES (%s, %s, NOW())
            ON CONFLICT (thread_id) DO UPDATE SET
                title = EXCLUDED.title,
                updated_at = NOW()
            """,
            (session_id, title),
        )


async def get_pool_stats() -> SessionPoolStats:
    """Return sandbox pool statistics."""
    sandbox_pool = require_sandbox_pool()
    return await sandbox_pool.get_stats()


# ---------------------------------------------------------------------------
# LLM auto-naming
# ---------------------------------------------------------------------------

_AUTONAME_SYSTEM_PROMPT = (
    "You are a helpful assistant that summarizes the user's intent into a VERY short title.\n"
    "Rules:\n"
    "- Use the same language as the user's message.\n"
    "- Max 10 characters for Chinese, max 25 characters for English.\n"
    "- No punctuation. No quotes. No emoji.\n"
    "- Capture the core intent or topic, not the full detail.\n"
    "\n"
    "Examples:\n"
    "- '帮我写个贪吃蛇' -> '贪吃蛇游戏'\n"
    "- '我想搭建一个博客网站，用Next.js和Tailwind' -> 'Next.js博客搭建'\n"
    "- 'Explain React Hooks' -> 'React Hooks'\n"
    "- 'Help me build a REST API with authentication' -> 'REST API Auth'\n"
)


async def autoname_from_message(message: str) -> Optional[str]:
    """Generate a short session title from the user's first message.

    Returns the title string, or ``None`` when generation fails or the
    input is empty.
    """
    if not message:
        return None

    api_key = SecretStr(OPENAI_API_KEY) if OPENAI_API_KEY else None
    if OPENAI_API_BASE:
        llm = ChatOpenAI(
            model=LLM_LITE_MODEL,
            api_key=api_key,
            base_url=OPENAI_API_BASE,
            temperature=0.7,
        )
    else:
        llm = ChatOpenAI(
            model=LLM_LITE_MODEL,
            api_key=api_key,
            temperature=0.7,
        )

    messages = [
        SystemMessage(content=_AUTONAME_SYSTEM_PROMPT),
        HumanMessage(content=message),
    ]

    response = await llm.ainvoke(messages)
    content = response.content
    title = content if isinstance(content, str) else str(content)
    title = title.strip().replace('"', "").replace("'", "")

    if len(title) > 25:
        title = title[:25]

    return title
