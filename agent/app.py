"""FastAPI application factory."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from lifespan import lifespan
from routers import (
    chat_router,
    health_router,
    knowledge_router,
    sessions_router,
    skills_router,
    terminal_router,
    workspace_router,
)


def create_app() -> FastAPI:
    app = FastAPI(title="Artisan API (LangGraph)", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(workspace_router)
    app.include_router(sessions_router)
    app.include_router(terminal_router)
    app.include_router(skills_router)
    app.include_router(chat_router)
    app.include_router(knowledge_router)

    return app
