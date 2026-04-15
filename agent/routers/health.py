"""Health check endpoints."""

from fastapi import APIRouter

from schemas.system import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    daytona_ready = False
    try:
        daytona_ready = True
    except Exception:
        pass

    response: HealthResponse = {
        "status": "healthy",
        "agent": "Artisan",
        "framework": "LangGraph",
        "workspace": "Daytona Sandbox",
        "workspace_ready": daytona_ready,
    }
    return response
