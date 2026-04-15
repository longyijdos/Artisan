"""Artisan - AI Agent with LangGraph, sandbox environment, web search, and skill system."""

import uvicorn

from app import create_app
from config import (
    DAYTONA_API_KEY,
    DAYTONA_SERVER_URL,
    LLM_MODEL,
    OPENAI_API_BASE,
    OPENAI_API_KEY,
    SERVER_PORT,
    TAVILY_API_KEY,
)

app = create_app()


if __name__ == "__main__":
    # Check for required API keys
    if not OPENAI_API_KEY:
        print("⚠️  Warning: OPENAI_API_KEY environment variable not set!")
        print("   Set it with: export OPENAI_API_KEY='your-key-here'")
        print()
    
    if not OPENAI_API_BASE:
        print("ℹ️  Info: OPENAI_API_BASE not set, using default OpenAI endpoint")
        print()
    
    print(f"🤖 Using LLM model: {LLM_MODEL}")
    print()
    
    if not TAVILY_API_KEY:
        print("⚠️  Warning: TAVILY_API_KEY environment variable not set!")
        print("   Web search functionality will be disabled.")
        print()

    if not DAYTONA_API_KEY or not DAYTONA_SERVER_URL:
        print("⚠️  Warning: Daytona configuration incomplete!")
        print("   Required: daytona_apikey, daytona_remote")
        print()

    print(f"🚀 Starting Artisan (LangGraph) on port {SERVER_PORT}...")
    uvicorn.run(app, host="0.0.0.0", port=SERVER_PORT)
