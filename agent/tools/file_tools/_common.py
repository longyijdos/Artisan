"""Shared helpers for file tools."""

from __future__ import annotations

from tools._runtime import resolve_sandbox_id


def get_language_from_ext(ext: str) -> str:
    """Get programming language from file extension."""
    lang_map = {
        ".py": "python",
        ".js": "javascript",
        ".ts": "typescript",
        ".tsx": "typescriptreact",
        ".jsx": "javascriptreact",
        ".html": "html",
        ".css": "css",
        ".json": "json",
        ".md": "markdown",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".sh": "bash",
        ".sql": "sql",
        ".go": "go",
        ".rs": "rust",
        ".java": "java",
        ".cpp": "cpp",
        ".c": "c",
        ".h": "c",
        ".hpp": "cpp",
    }
    return lang_map.get(ext.lower(), "text")


def looks_like_binary_text(content: str) -> bool:
    """Best-effort check to avoid dumping binary content into model context."""
    if not content:
        return False
    if "\x00" in content:
        return True
    sample = content[:4096]
    non_printable = 0
    replacement_chars = 0
    for ch in sample:
        code = ord(ch)
        if code in (9, 10, 13):
            continue
        if ch == "\ufffd":
            replacement_chars += 1
            continue
        if code < 32:
            non_printable += 1
    if (non_printable / len(sample)) > 0.3:
        return True
    return (replacement_chars / len(sample)) > 0.1


__all__ = ["get_language_from_ext", "looks_like_binary_text", "resolve_sandbox_id"]
