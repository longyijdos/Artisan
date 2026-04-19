"""Retrieve relevant chunks from the knowledge base via cosine similarity."""

import logging
from dataclasses import dataclass

from config import RAG_SCORE_THRESHOLD, RAG_TOP_K
from utils.db import get_db_connection

from .embeddings import embed_query

logger = logging.getLogger(__name__)


@dataclass
class ChunkResult:
    content: str
    score: float


async def search_chunks(
    owner_id: str,
    query: str,
    top_k: int = RAG_TOP_K,
    threshold: float = RAG_SCORE_THRESHOLD,
    source_ids: list[int] | None = None,
) -> list[ChunkResult]:
    """Search for the most relevant chunks given a query.

    When *source_ids* is provided, only chunks belonging to those sources are
    searched.  Returns up to *top_k* chunks whose cosine similarity exceeds
    *threshold*.
    """
    try:
        query_embedding = await embed_query(query)
    except Exception as exc:
        logger.error("Failed to embed query: %s", exc)
        return []

    pool = await get_db_connection()
    try:
        async with pool.connection() as conn:
            if source_ids:
                # Filter by specific source IDs
                placeholders = ", ".join(["%s"] * len(source_ids))
                result = await conn.execute(
                    f"""
                    SELECT kc.content,
                           1 - (kc.embedding <=> %s::vector) AS score
                    FROM knowledge_chunks kc
                    JOIN knowledge_sources ks ON kc.source_id = ks.id
                    WHERE ks.owner_id = %s
                      AND ks.id IN ({placeholders})
                    ORDER BY kc.embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (str(query_embedding), owner_id, *source_ids, str(query_embedding), top_k),
                )
            else:
                result = await conn.execute(
                    """
                    SELECT kc.content,
                           1 - (kc.embedding <=> %s::vector) AS score
                    FROM knowledge_chunks kc
                    JOIN knowledge_sources ks ON kc.source_id = ks.id
                    WHERE ks.owner_id = %s
                    ORDER BY kc.embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (str(query_embedding), owner_id, str(query_embedding), top_k),
                )
            rows = await result.fetchall()
    except Exception as exc:
        logger.error("Knowledge search failed: %s", exc)
        return []

    chunks: list[ChunkResult] = []
    for row in rows:
        content, score = row[0], float(row[1])
        if score >= threshold:
            chunks.append(ChunkResult(content=content, score=score))

    return chunks
