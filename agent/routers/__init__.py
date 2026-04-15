"""Routers package."""

from .chat import router as chat_router
from .health import router as health_router
from .knowledge import knowledge_router
from .sessions import router as sessions_router
from .skills import skills_router
from .terminal import router as terminal_router
from .workspace import router as workspace_router

__all__ = ["health_router", "workspace_router", "sessions_router", "terminal_router", "skills_router", "chat_router", "knowledge_router"]
