"""Knowledge base services — chunking, indexing, and retrieval."""

from .indexing import IndexResult, index_path
from .retrieval import ChunkResult, search_chunks

__all__ = [
    "IndexResult",
    "index_path",
    "ChunkResult",
    "search_chunks",
]
