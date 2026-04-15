"""Active-run lifecycle management for chat streams."""

import asyncio
from dataclasses import dataclass


@dataclass
class ActiveRun:
    thread_id: str
    run_id: str
    task: asyncio.Task
    stop_event: asyncio.Event


ACTIVE_RUNS: dict[str, ActiveRun] = {}
ACTIVE_RUNS_LOCK = asyncio.Lock()


async def register_run(thread_id: str, run: ActiveRun) -> None:
    """Register *run*, cancelling any previous run for the same thread."""
    async with ACTIVE_RUNS_LOCK:
        existing = ACTIVE_RUNS.get(thread_id)
        if existing:
            existing.stop_event.set()
            existing.task.cancel()
        ACTIVE_RUNS[thread_id] = run


async def unregister_run(thread_id: str, run_id: str) -> None:
    """Remove *run_id* from the active set (no-op if already gone or replaced)."""
    async with ACTIVE_RUNS_LOCK:
        current = ACTIVE_RUNS.get(thread_id)
        if not current:
            return
        if current.run_id != run_id:
            return
        ACTIVE_RUNS.pop(thread_id, None)


async def stop_one(thread_id: str) -> bool:
    """Signal the active run for *thread_id* to stop. Returns ``True`` if found."""
    async with ACTIVE_RUNS_LOCK:
        current = ACTIVE_RUNS.get(thread_id)
        if not current:
            return False
        current.stop_event.set()
        current.task.cancel()
        return True


async def stop_all() -> int:
    """Signal all active runs to stop. Returns the count of runs signalled."""
    async with ACTIVE_RUNS_LOCK:
        runs = list(ACTIVE_RUNS.values())
        for run in runs:
            run.stop_event.set()
            run.task.cancel()
    return len(runs)
