"""Monkey-patch: expose tool_call_id in astream_events v2 tool events."""

from __future__ import annotations

import logging
from typing import Any, cast

logger = logging.getLogger(__name__)

_patched = False


def apply_tool_call_id_patch() -> None:
    """Patch _AstreamEventsCallbackHandler to expose tool_call_id."""
    global _patched
    if _patched:
        return

    from uuid import UUID

    from langchain_core.runnables.schema import EventData, StandardStreamEvent
    from langchain_core.tracers.event_stream import (
        _assign_name,
        _AstreamEventsCallbackHandler,
    )

    _original_write_run_start_info = _AstreamEventsCallbackHandler._write_run_start_info

    def _patched_write_run_start_info(
        self: _AstreamEventsCallbackHandler,
        run_id: UUID,
        *,
        tags: list[str] | None,
        metadata: dict[str, Any] | None,
        parent_run_id: UUID | None,
        name_: str,
        run_type: str,
        **kwargs: Any,
    ) -> None:
        _original_write_run_start_info(
            self,
            run_id,
            tags=tags,
            metadata=metadata,
            parent_run_id=parent_run_id,
            name_=name_,
            run_type=run_type,
            **kwargs,
        )
        if "tool_call_id" in kwargs:
            run_info = self.run_map.get(run_id)
            if run_info is not None:
                run_info["tool_call_id"] = kwargs["tool_call_id"]  # type: ignore[typeddict-unknown-key]

    _AstreamEventsCallbackHandler._write_run_start_info = _patched_write_run_start_info  # type: ignore[method-assign]

    async def _patched_on_tool_start(
        self: _AstreamEventsCallbackHandler,
        serialized: dict[str, Any],
        input_str: str,
        *,
        run_id: UUID,
        tags: list[str] | None = None,
        parent_run_id: UUID | None = None,
        metadata: dict[str, Any] | None = None,
        name: str | None = None,
        inputs: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        name_ = _assign_name(name, serialized)
        tool_call_id = kwargs.get("tool_call_id")

        self._write_run_start_info(
            run_id,
            tags=tags,
            metadata=metadata,
            parent_run_id=parent_run_id,
            name_=name_,
            run_type="tool",
            inputs=inputs,
            tool_call_id=tool_call_id,
        )

        data: dict[str, Any] = {"input": inputs or {}}
        if tool_call_id is not None:
            data["tool_call_id"] = tool_call_id

        self._send(
            StandardStreamEvent(
                event="on_tool_start",
                data=cast(EventData, data),
                name=name_,
                tags=tags or [],
                run_id=str(run_id),
                metadata=metadata or {},
                parent_ids=self._get_parent_ids(run_id),
            ),
            "tool",
        )

    _AstreamEventsCallbackHandler.on_tool_start = _patched_on_tool_start  # type: ignore[method-assign]

    async def _patched_on_tool_end(
        self: _AstreamEventsCallbackHandler,
        output: Any,
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        run_info, inputs = self._get_tool_run_info_with_inputs(run_id)
        tool_call_id = run_info.get("tool_call_id")

        data: dict[str, Any] = {"output": output, "input": inputs}
        if tool_call_id is not None:
            data["tool_call_id"] = tool_call_id

        self._send(
            StandardStreamEvent(
                event="on_tool_end",
                data=cast(EventData, data),
                run_id=str(run_id),
                name=run_info["name"],
                tags=run_info["tags"],
                metadata=run_info["metadata"],
                parent_ids=self._get_parent_ids(run_id),
            ),
            "tool",
        )

    _AstreamEventsCallbackHandler.on_tool_end = _patched_on_tool_end  # type: ignore[method-assign]

    async def _patched_on_tool_error(
        self: _AstreamEventsCallbackHandler,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        tags: list[str] | None = None,
        **kwargs: Any,
    ) -> None:
        run_info, inputs = self._get_tool_run_info_with_inputs(run_id)
        tool_call_id = run_info.get("tool_call_id")

        data: dict[str, Any] = {"error": error, "input": inputs}
        if tool_call_id is not None:
            data["tool_call_id"] = tool_call_id

        self._send(
            StandardStreamEvent(
                event="on_tool_error",
                data=cast(EventData, data),
                run_id=str(run_id),
                name=run_info["name"],
                tags=run_info["tags"],
                metadata=run_info["metadata"],
                parent_ids=self._get_parent_ids(run_id),
            ),
            "tool",
        )

    _AstreamEventsCallbackHandler.on_tool_error = _patched_on_tool_error  # type: ignore[method-assign]

    _patched = True
    logger.info("langchain event_stream monkey-patch applied (tool_call_id exposed)")
