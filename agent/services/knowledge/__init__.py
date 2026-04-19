"""Knowledge base services — chunking, indexing, and retrieval."""

from .embeddings import embed_query, embed_texts, is_embedding_configured
from .indexing import IndexResult, index_path
from .retrieval import ChunkResult, search_chunks

__all__ = [
    "embed_query",
    "embed_texts",
    "is_embedding_configured",
    "IndexResult",
    "index_path",
    "ChunkResult",
    "search_chunks",
]
