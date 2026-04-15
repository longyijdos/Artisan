"""Mutable assistant-message state for a streaming chat run."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class AssistantMessageState:
    open_ui_message_id: str | None = None
    open_message_parts: list[str] = field(default_factory=list)
    reasoning_parts: list[str] = field(default_factory=list)
    reasoning_started: bool = False
    message_counter: int = 0
    assistant_message_cache: dict[str, str] = field(default_factory=dict)

    def ensure_open_message(self, *, run_id: str, raw_id: object) -> tuple[str, bool]:
        if self.open_ui_message_id is not None:
            return self.open_ui_message_id, False

        self.open_ui_message_id = self.to_ui_message_id(run_id=run_id, raw_id=raw_id)
        self.open_message_parts = []
        self.reasoning_parts = []
        return self.open_ui_message_id, True

    def to_ui_message_id(self, *, run_id: str, raw_id: object) -> str:
        if isinstance(raw_id, str):
            normalized = raw_id.strip()
            if normalized:
                cached = self.assistant_message_cache.get(normalized)
                if cached:
                    return cached
                generated = (
                    normalized
                    if normalized.startswith("assistant-")
                    else f"assistant-{normalized}"
                )
                self.assistant_message_cache[normalized] = generated
                return generated

        self.message_counter += 1
        return f"assistant-{run_id}-{self.message_counter}"

    def current_content(self) -> str:
        return "".join(self.open_message_parts)

    def reset_open_message(self) -> None:
        self.open_ui_message_id = None
        self.open_message_parts = []
        self.reasoning_parts = []
        self.reasoning_started = False
