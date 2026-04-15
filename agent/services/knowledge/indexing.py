"""Index files / folders into the knowledge base."""

import asyncio
import logging
from dataclasses import dataclass

from sandbox import DaytonaClient
from utils.db import get_db_connection
from utils.runtime import require_embedding_model, require_sandbox_pool

from .chunking import chunk_text, should_skip_file

logger = logging.getLogger(__name__)


@dataclass
class IndexResult:
    source_id: int
    name: str
    source_type: str
    chunk_count: int


async def _embed_texts(texts: list[str]) -> list[list[float]]:
    """Run embedding in a thread to avoid blocking the event loop."""
    model = require_embedding_model()

    def _encode() -> list[list[float]]:
        return model.encode(texts, normalize_embeddings=True).tolist()

    return await asyncio.to_thread(_encode)


async def _index_single_file(
    client: DaytonaClient,
    sandbox_id: str,
    file_path: str,
    owner_id: str,
) -> IndexResult | None:
    """Read, chunk, embed, and store a single file."""
    filename = file_path.rsplit("/", 1)[-1] if "/" in file_path else file_path

    if should_skip_file(filename):
        logger.debug("Skipping file: %s", file_path)
        return None

    try:
        content = await client.read_file(sandbox_id, file_path)
    except Exception as exc:
        logger.warning("Failed to read %s: %s", file_path, exc)
        return None

    chunks = chunk_text(content, filename)
    if not chunks:
        return None

    # Embed all chunks
    embeddings = await _embed_texts(chunks)

    pool = await get_db_connection()
    async with pool.connection() as conn:
        # Insert knowledge source
        result = await conn.execute(
            """
            INSERT INTO knowledge_sources (owner_id, name, source_type, chunk_count)
            VALUES (%s, %s, 'file', %s)
            RETURNING id
            """,
            (owner_id, filename, len(chunks)),
        )
        row = await result.fetchone()
        assert row is not None
        source_id: int = row[0]

        # Batch insert chunks
        for idx, (chunk, emb) in enumerate(zip(chunks, embeddings)):
            await conn.execute(
                """
                INSERT INTO knowledge_chunks (source_id, chunk_index, content, embedding)
                VALUES (%s, %s, %s, %s::vector)
                """,
                (source_id, idx, chunk, str(emb)),
            )

    return IndexResult(
        source_id=source_id,
        name=filename,
        source_type="file",
        chunk_count=len(chunks),
    )


async def _list_files_recursive(
    client: DaytonaClient,
    sandbox_id: str,
    dir_path: str,
) -> list[str]:
    """Recursively list all file paths under a directory."""
    file_paths: list[str] = []
    try:
        entries = await client.list_files(sandbox_id, dir_path)
    except Exception as exc:
        logger.warning("Failed to list %s: %s", dir_path, exc)
        return file_paths

    for entry in entries:
        full_path = f"{dir_path}/{entry['name']}" if dir_path else entry["name"]
        if entry["is_dir"]:
            # Skip hidden directories and common non-source directories
            if entry["name"].startswith(".") or entry["name"] in {
                "node_modules", "__pycache__", ".git", "dist", "build", ".next", ".venv", "venv",
            }:
                continue
            sub_files = await _list_files_recursive(client, sandbox_id, full_path)
            file_paths.extend(sub_files)
        else:
            file_paths.append(full_path)

    return file_paths


async def index_path(
    owner_id: str,
    sandbox_id: str,
    path: str,
    is_dir: bool,
) -> list[IndexResult]:
    """Index a file or directory into the knowledge base.

    Returns a list of IndexResult for each successfully indexed file.
    """
    pool = require_sandbox_pool()
    client = pool.daytona_client

    if is_dir:
        file_paths = await _list_files_recursive(client, sandbox_id, path)
        results: list[IndexResult] = []
        for fp in file_paths:
            result = await _index_single_file(client, sandbox_id, fp, owner_id)
            if result is not None:
                results.append(result)

        # If it's a directory and we indexed files, also create a folder-level source
        if results:
            folder_name = path.rsplit("/", 1)[-1] if "/" in path else path
            total_chunks = sum(r.chunk_count for r in results)
            p = await get_db_connection()
            async with p.connection() as conn:
                await conn.execute(
                    """
                    INSERT INTO knowledge_sources (owner_id, name, source_type, chunk_count)
                    VALUES (%s, %s, 'folder', %s)
                    """,
                    (owner_id, folder_name + "/", total_chunks),
                )
        return results
    else:
        result = await _index_single_file(client, sandbox_id, path, owner_id)
        return [result] if result else []
