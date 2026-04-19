"""Global runtime state shared across routers and services.

Initialized during application lifespan. Modules that need the compiled
LangGraph or the sandbox pool should import from here.
"""

from collections.abc import Callable

from langgraph.graph.state import CompiledStateGraph

from sandbox import SandboxPool

# ---------------------------------------------------------------------------
# Compiled graph
# ---------------------------------------------------------------------------

CompiledGraphGetter = Callable[[], CompiledStateGraph | None]

_get_compiled_graph: CompiledGraphGetter | None = None


def set_graph_getter(getter: CompiledGraphGetter) -> None:
    """Register the function that returns the compiled graph."""
    global _get_compiled_graph
    _get_compiled_graph = getter


def get_compiled_graph() -> CompiledStateGraph | None:
    """Return the compiled graph instance, or ``None`` if not yet set."""
    if _get_compiled_graph:
        return _get_compiled_graph()
    return None


# ---------------------------------------------------------------------------
# Sandbox pool
# ---------------------------------------------------------------------------

_sandbox_pool: SandboxPool | None = None


def set_sandbox_pool(pool: SandboxPool | None) -> None:
    """Register the sandbox pool instance."""
    global _sandbox_pool
    _sandbox_pool = pool


def get_sandbox_pool() -> SandboxPool | None:
    """Return the sandbox pool instance."""
    return _sandbox_pool


def require_sandbox_pool() -> SandboxPool:
    """Return the sandbox pool instance, raising when startup has not initialized it."""
    if _sandbox_pool is None:
        raise RuntimeError("sandbox pool not initialized")
    return _sandbox_pool
