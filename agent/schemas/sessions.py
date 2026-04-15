"""Contracts for session-related HTTP payloads."""

from dataclasses import dataclass
from typing import NotRequired, TypedDict

from fastapi import HTTPException
from pydantic import BaseModel


class SessionPayload(TypedDict):
    id: str
    title: str
    lastUpdateTime: float | None
    createdAt: NotRequired[float | None]


class SessionListResponse(TypedDict):
    sessions: list[SessionPayload]


class SessionCreateResponse(TypedDict):
    id: str
    title: str
    lastUpdateTime: float | None


class SessionDeleteResponse(TypedDict):
    success: bool
    id: str


class SessionTitleUpdateResponse(TypedDict):
    success: bool
    id: str
    title: str


class SessionPoolStatsConfig(TypedDict):
    min_pool_size: int
    auto_stop_minutes: int
    auto_archive_minutes: int


class SessionPoolStats(TypedDict):
    creating: int
    available: int
    assigned: int
    error: int
    total: int
    config: SessionPoolStatsConfig


class SessionPoolStatsResponse(TypedDict):
    stats: SessionPoolStats


class SessionAutonameRequest(BaseModel):
    message: str


@dataclass(frozen=True, slots=True)
class NormalizedSessionAutonameRequest:
    message: str


class SessionAutonameResponse(TypedDict):
    title: str | None


def normalize_autoname_request(
    request_payload: SessionAutonameRequest,
) -> NormalizedSessionAutonameRequest:
    message = request_payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    return NormalizedSessionAutonameRequest(message=message)
