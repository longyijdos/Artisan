"""Contracts for simple system endpoints."""

from typing import TypedDict


class TerminalPreviewResponse(TypedDict):
    url: str


class HealthResponse(TypedDict):
    status: str
    agent: str
    framework: str
    workspace: str
    workspace_ready: bool
