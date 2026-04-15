"""Knowledge base endpoints — index, list, delete."""

import logging

from fastapi import APIRouter, HTTPException

from schemas.knowledge import (
    KnowledgeCheckRequest,
    KnowledgeCheckResponse,
    KnowledgeDeleteResponse,
    KnowledgeIndexRequest,
    KnowledgeIndexResponse,
    KnowledgeIndexResultItem,
    KnowledgeListResponse,
    KnowledgeSourceItem,
)
from services.knowledge import index_path
from utils.db import get_db_connection, get_sandbox_id_for_thread

logger = logging.getLogger(__name__)

knowledge_router = APIRouter(prefix="/knowledge", tags=["knowledge"])


def _derive_name(path: str, is_dir: bool) -> str:
    """Derive the display name from a path (same logic as indexing)."""
    name = path.rsplit("/", 1)[-1] if "/" in path else path
    if is_dir and not name.endswith("/"):
        name += "/"
    return name


@knowledge_router.post("/check", response_model=KnowledgeCheckResponse)
async def check_knowledge(req: KnowledgeCheckRequest):
    """Check whether a knowledge source with the same name already exists."""
    try:
        name = _derive_name(req.path, req.is_dir)

        pool = await get_db_connection()
        async with pool.connection() as conn:
            result = await conn.execute(
                "SELECT id FROM knowledge_sources WHERE owner_id = 'default' AND name = %s",
                (name,),
            )
            rows = await result.fetchall()

        source_ids = [row[0] for row in rows]
        return KnowledgeCheckResponse(exists=len(source_ids) > 0, source_ids=source_ids, name=name)
    except Exception as e:
        logger.exception("Error checking knowledge: %s", e)
        raise HTTPException(status_code=500, detail="Failed to check knowledge") from e


@knowledge_router.post("/index", response_model=KnowledgeIndexResponse)
async def index_knowledge(req: KnowledgeIndexRequest):
    """Index a file or folder into the knowledge base."""
    try:
        thread_id = req.thread_id.strip()
        if not thread_id:
            raise HTTPException(status_code=400, detail="thread_id is required")

        sandbox_id = await get_sandbox_id_for_thread(thread_id)
        if not sandbox_id:
            raise HTTPException(status_code=404, detail="No sandbox found for this session")

        # If force=True, delete existing sources with the same name first
        if req.force:
            name = _derive_name(req.path, req.is_dir)
            pool = await get_db_connection()
            async with pool.connection() as conn:
                await conn.execute(
                    "DELETE FROM knowledge_sources WHERE owner_id = 'default' AND name = %s",
                    (name,),
                )

        results = await index_path(
            owner_id="default",
            sandbox_id=sandbox_id,
            path=req.path,
            is_dir=req.is_dir,
        )

        if not results:
            return KnowledgeIndexResponse(
                success=True,
                message="No indexable content found",
                results=[],
            )

        total_chunks = sum(r.chunk_count for r in results)
        return KnowledgeIndexResponse(
            success=True,
            message=f"Indexed {len(results)} file(s), {total_chunks} chunks",
            results=[
                KnowledgeIndexResultItem(
                    source_id=r.source_id,
                    name=r.name,
                    source_type=r.source_type,
                    chunk_count=r.chunk_count,
                )
                for r in results
            ],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error indexing knowledge: %s", e)
        raise HTTPException(status_code=500, detail="Failed to index knowledge") from e


@knowledge_router.get("/list", response_model=KnowledgeListResponse)
async def list_knowledge():
    """List all knowledge sources for the default owner."""
    try:
        pool = await get_db_connection()
        async with pool.connection() as conn:
            result = await conn.execute(
                """
                SELECT id, name, source_type, chunk_count, created_at
                FROM knowledge_sources
                WHERE owner_id = 'default'
                ORDER BY created_at DESC
                """
            )
            rows = await result.fetchall()

        sources = [
            KnowledgeSourceItem(
                id=row[0],
                name=row[1],
                source_type=row[2],
                chunk_count=row[3],
                created_at=row[4].isoformat() if row[4] else "",
            )
            for row in rows
        ]
        return KnowledgeListResponse(sources=sources)
    except Exception as e:
        logger.exception("Error listing knowledge sources: %s", e)
        raise HTTPException(status_code=500, detail="Failed to list knowledge sources") from e


@knowledge_router.delete("/delete", response_model=KnowledgeDeleteResponse)
async def delete_knowledge(source_id: int):
    """Delete a knowledge source and its chunks (CASCADE)."""
    try:
        pool = await get_db_connection()
        async with pool.connection() as conn:
            result = await conn.execute(
                "DELETE FROM knowledge_sources WHERE id = %s AND owner_id = 'default' RETURNING id",
                (source_id,),
            )
            row = await result.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Knowledge source not found")

        return KnowledgeDeleteResponse(success=True, message="Knowledge source deleted")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error deleting knowledge source: %s", e)
        raise HTTPException(status_code=500, detail="Failed to delete knowledge source") from e
