"""Text chunking with language-aware splitting."""

import logging
import os
from pathlib import Path

from langchain_text_splitters import Language, RecursiveCharacterTextSplitter

from config import RAG_CHUNK_OVERLAP, RAG_CHUNK_SIZE

logger = logging.getLogger(__name__)

# File extensions to skip (binary, images, videos, locks, etc.)
SKIP_EXTENSIONS = frozenset({
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg", ".webp",
    ".mp4", ".avi", ".mov", ".mkv", ".webm", ".mp3", ".wav", ".flac",
    ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".exe", ".dll", ".so", ".dylib", ".bin", ".dat",
    ".lock", ".lockb", ".pyc", ".pyo", ".class", ".o", ".obj",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".sqlite", ".db",
})

# Maximum file size to index (1 MB)
MAX_FILE_SIZE = 1 * 1024 * 1024

# Map file extensions to langchain Language enum
_EXT_TO_LANGUAGE: dict[str, Language] = {
    ".py": Language.PYTHON,
    ".js": Language.JS,
    ".jsx": Language.JS,
    ".ts": Language.TS,
    ".tsx": Language.TS,
    ".md": Language.MARKDOWN,
    ".markdown": Language.MARKDOWN,
    ".html": Language.HTML,
    ".htm": Language.HTML,
    ".go": Language.GO,
    ".java": Language.JAVA,
    ".rs": Language.RUST,
    ".rb": Language.RUBY,
    ".php": Language.PHP,
    ".scala": Language.SCALA,
    ".swift": Language.SWIFT,
    ".c": Language.C,
    ".cpp": Language.CPP,
    ".h": Language.CPP,
    ".hpp": Language.CPP,
    ".sol": Language.SOL,
    ".lua": Language.LUA,
}


def should_skip_file(filename: str) -> bool:
    """Return True if the file should be skipped during indexing."""
    ext = Path(filename).suffix.lower()
    if ext in SKIP_EXTENSIONS:
        return True
    basename = os.path.basename(filename).lower()
    # Skip hidden files and common non-text files
    if basename.startswith("."):
        return True
    if basename in {"package-lock.json", "yarn.lock", "pnpm-lock.yaml"}:
        return True
    return False


def chunk_text(text: str, filename: str) -> list[str]:
    """Split text into chunks using language-aware or generic splitter.

    Returns a list of chunk strings.  Empty list if text is blank or file
    exceeds size limits.
    """
    if not text or not text.strip():
        return []

    if len(text.encode("utf-8")) > MAX_FILE_SIZE:
        logger.info("Skipping oversized file: %s", filename)
        return []

    ext = Path(filename).suffix.lower()
    language = _EXT_TO_LANGUAGE.get(ext)

    if language is not None:
        try:
            splitter = RecursiveCharacterTextSplitter.from_language(
                language=language,
                chunk_size=RAG_CHUNK_SIZE,
                chunk_overlap=RAG_CHUNK_OVERLAP,
            )
        except Exception:
            # Fall back to generic splitter
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=RAG_CHUNK_SIZE,
                chunk_overlap=RAG_CHUNK_OVERLAP,
            )
    else:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=RAG_CHUNK_SIZE,
            chunk_overlap=RAG_CHUNK_OVERLAP,
        )

    chunks = splitter.split_text(text)
    return [c for c in chunks if c.strip()]
