"""Application lifespan and startup resources."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph.state import CompiledStateGraph

from config import DATABASE_URL, EMBEDDING_MODEL_NAME
from graph import build_graph
from sandbox import SandboxPool
from utils.db import close_db_connection, ensure_knowledge_tables
from utils.runtime import set_embedding_model, set_graph_getter, set_sandbox_pool

_compiled_graph: CompiledStateGraph | None = None


def get_compiled_graph() -> CompiledStateGraph | None:
    return _compiled_graph


def _load_embedding_model(model_name: str) -> None:
    """Load the sentence-transformers embedding model (runs on CPU)."""
    try:
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer(model_name, device="cpu")
        set_embedding_model(model)
        print(f"✅ Embedding model loaded: {model_name}")
    except Exception as exc:
        print(f"⚠️  Failed to load embedding model: {exc}")


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _compiled_graph

    sandbox_pool: SandboxPool | None = None

    try:
        async with AsyncPostgresSaver.from_conn_string(DATABASE_URL) as checkpointer:
            await checkpointer.setup()
            print("✅ PostgreSQL checkpointer initialized")

            # Ensure knowledge base tables
            await ensure_knowledge_tables()
            print("✅ Knowledge base tables ready")

            workflow = build_graph()
            _compiled_graph = workflow.compile(checkpointer=checkpointer)
            print("✅ LangGraph agent compiled with persistence")

            set_graph_getter(get_compiled_graph)

            # Load embedding model
            _load_embedding_model(EMBEDDING_MODEL_NAME)

            sandbox_pool = SandboxPool()
            set_sandbox_pool(sandbox_pool)
            await sandbox_pool.start()
            print("✅ Sandbox pool started")

            yield
    finally:
        _compiled_graph = None
        if sandbox_pool is not None:
            await sandbox_pool.stop()
        await close_db_connection()
        set_sandbox_pool(None)
        set_embedding_model(None)
        print("👋 Shutting down Artisan")
