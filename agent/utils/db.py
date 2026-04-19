import logging
from typing import Optional

from psycopg_pool import AsyncConnectionPool

from config import DATABASE_URL, EMBEDDING_DIMENSION

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global connection pool for session queries
_db_pool = None


async def get_db_connection():
    """Get a database connection for session queries."""
    global _db_pool
    if _db_pool is None:
        _db_pool = AsyncConnectionPool(
            DATABASE_URL,
            min_size=1,
            max_size=5,
            open=False,
        )
        await _db_pool.open()
    return _db_pool


async def close_db_connection():
    """Close the shared database connection pool."""
    global _db_pool
    if _db_pool is None:
        return

    if not _db_pool.closed:
        await _db_pool.close()
    _db_pool = None


async def update_session_last_active(thread_id: str):
    """Update session last active time."""
    try:
        pool = await get_db_connection()
        async with pool.connection() as conn:
            await conn.execute(
                """
                UPDATE session_metadata 
                SET updated_at = NOW() 
                WHERE thread_id = %s
                """,
                (thread_id,)
            )
    except Exception as e:
        logger.error(f"Error updating session time: {e}")

async def get_sandbox_id_for_thread(thread_id: str) -> Optional[str]:
    """Get the sandbox_id for a given thread_id."""
    if not thread_id:
        return None
        
    try:
        pool = await get_db_connection()
        async with pool.connection() as conn:
            result = await conn.execute(
                "SELECT sandbox_id FROM session_metadata WHERE thread_id = %s",
                (thread_id,)
            )
            row = await result.fetchone()
            if row:
                return row[0]
            return None
    except Exception as e:
        logger.error(f"Error getting sandbox_id: {e}")
        return None

async def ensure_session_metadata_table():
    """Ensure the session_metadata table exists."""
    pool = await get_db_connection()
    async with pool.connection() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS session_metadata (
                thread_id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '新对话',
                sandbox_id TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)


async def ensure_knowledge_tables():
    """Ensure the knowledge_sources and knowledge_chunks tables exist (with pgvector)."""
    pool = await get_db_connection()
    async with pool.connection() as conn:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_sources (
                id           BIGSERIAL PRIMARY KEY,
                owner_id     TEXT NOT NULL DEFAULT 'default',
                name         TEXT NOT NULL,
                source_type  TEXT NOT NULL DEFAULT 'file',
                chunk_count  INTEGER NOT NULL DEFAULT 0,
                created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_ks_owner ON knowledge_sources (owner_id)"
        )
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_chunks (
                id           BIGSERIAL PRIMARY KEY,
                source_id    BIGINT NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
                chunk_index  INTEGER NOT NULL,
                content      TEXT NOT NULL,
                embedding    vector(%d),
                created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """ % EMBEDDING_DIMENSION)
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_kc_source ON knowledge_chunks (source_id)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_kc_embedding "
            "ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)"
        )
