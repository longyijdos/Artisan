"""Mutable tool-call state for a streaming chat run."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class ToolCallState:
    """Tracks streaming tool-call chunks during a single model response."""

    pending_chunk_names: dict[int, str] = field(default_factory=dict)
    pending_chunk_ids: dict[int, str] = field(default_factory=dict)

    def reset_model_stream(self) -> None:
        self.pending_chunk_names.clear()
        self.pending_chunk_ids.clear()

    def remember_chunk_name(self, index: int, name: str | None) -> None:
        if name:
            self.pending_chunk_names[index] = name

    def get_chunk_name(self, index: int) -> str | None:
        return self.pending_chunk_names.get(index)

    def resolve_chunk_id(self, *, index: int, raw_id: object) -> str:
        """Return the cached tool_call_id for *index*, caching *raw_id* on first sight."""
        if isinstance(raw_id, str) and raw_id:
            self.pending_chunk_ids[index] = raw_id
            return raw_id

        existing = self.pending_chunk_ids.get(index)
        if existing:
            return existing

        return ""
