"""OpenAI-compatible embedding helpers for the knowledge base."""

from __future__ import annotations

from typing import Any

import httpx

from config import (
    EMBEDDING_API_BASE,
    EMBEDDING_API_KEY,
    EMBEDDING_DIMENSION,
    EMBEDDING_MODEL_NAME,
)


def is_embedding_configured() -> bool:
    """Return whether the remote embedding backend is configured."""
    return bool(EMBEDDING_API_KEY and EMBEDDING_API_BASE and EMBEDDING_MODEL_NAME)


def _embedding_endpoint() -> str:
    if not EMBEDDING_API_BASE:
        raise RuntimeError("EMBEDDING_API_BASE not configured")
    return f"{EMBEDDING_API_BASE.rstrip('/')}/embeddings"


def _embedding_headers() -> dict[str, str]:
    if not EMBEDDING_API_KEY:
        raise RuntimeError("EMBEDDING_API_KEY not configured")
    return {
        "Authorization": f"Bearer {EMBEDDING_API_KEY}",
        "Content-Type": "application/json",
    }


def _embedding_payload(texts: list[str]) -> dict[str, Any]:
    return {
        "model": EMBEDDING_MODEL_NAME,
        "input": texts,
        "dimensions": EMBEDDING_DIMENSION,
        "encoding_format": "float",
    }


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Create embeddings for one or more texts using a remote API."""
    if not texts:
        return []
    if not is_embedding_configured():
        raise RuntimeError("embedding API not configured")

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
            response = await client.post(
                _embedding_endpoint(),
                headers=_embedding_headers(),
                json=_embedding_payload(texts),
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text.strip()
        raise RuntimeError(
            f"embedding API request failed with {exc.response.status_code}: {detail}"
        ) from exc
    except httpx.HTTPError as exc:
        raise RuntimeError(f"embedding API request failed: {exc}") from exc

    payload = response.json()
    data = payload.get("data")
    if not isinstance(data, list):
        raise RuntimeError("embedding API response missing data list")

    ordered = sorted(data, key=lambda item: int(item.get("index", 0)))
    embeddings: list[list[float]] = []
    for item in ordered:
        embedding = item.get("embedding")
        if not isinstance(embedding, list):
            raise RuntimeError("embedding API response missing embedding vector")
        if len(embedding) != EMBEDDING_DIMENSION:
            raise RuntimeError(
                f"embedding dimension mismatch: expected {EMBEDDING_DIMENSION}, "
                f"got {len(embedding)}"
            )
        embeddings.append([float(value) for value in embedding])

    if len(embeddings) != len(texts):
        raise RuntimeError(
            f"embedding count mismatch: expected {len(texts)}, got {len(embeddings)}"
        )

    return embeddings


async def embed_query(query: str) -> list[float]:
    """Create a single embedding vector for a query string."""
    embeddings = await embed_texts([query])
    return embeddings[0]
