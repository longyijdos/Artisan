"""Centralized configuration — every env var is read here and only here."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from project root .env
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://artisan:artisan123@localhost:5432/artisan",
)

# ---------------------------------------------------------------------------
# LLM
# ---------------------------------------------------------------------------
LLM_MODEL = os.getenv("LLM_MODEL", "deepseek-reasoner")
LLM_LITE_MODEL = os.getenv("LLM_LITE_MODEL", "deepseek-chat")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE")

# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

# ---------------------------------------------------------------------------
# Daytona Sandbox
# ---------------------------------------------------------------------------
DAYTONA_API_KEY = os.getenv("daytona_apikey")
DAYTONA_SERVER_URL = os.getenv("daytona_remote")
DAYTONA_DEFAULT_SNAPSHOT = os.getenv("defaultsnapshot")
DAYTONA_ORG_ID = os.getenv("organizationID")
SKILLS_LOCAL_DIR = os.getenv(
    "SKILLS_LOCAL_DIR",
    str(Path(__file__).parent / "skills"),
)

# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------
SERVER_PORT = int(os.getenv("AGENT_SERVER_PORT", "8664"))

# ---------------------------------------------------------------------------
# Upload limits
# ---------------------------------------------------------------------------
MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB

# ---------------------------------------------------------------------------
# RAG Knowledge Base
# ---------------------------------------------------------------------------
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "BAAI/bge-small-zh-v1.5")
EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "512"))
RAG_CHUNK_SIZE = int(os.getenv("RAG_CHUNK_SIZE", "512"))
RAG_CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "64"))
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "6"))
RAG_SCORE_THRESHOLD = float(os.getenv("RAG_SCORE_THRESHOLD", "0.0"))

# ---------------------------------------------------------------------------
# Model context windows (token limits)
# ---------------------------------------------------------------------------
MODEL_CONTEXT_WINDOWS: dict[str, int] = {
    "deepseek-reasoner": 128_000,
    "deepseek-chat": 128_000,
}
