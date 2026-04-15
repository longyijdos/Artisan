"""Typed contracts for backend tool inputs/outputs."""

from __future__ import annotations

from typing import Literal, TypedDict

ToolStatus = Literal["success", "error"]


class FileWriteResponse(TypedDict, total=False):
    status: ToolStatus
    message: str
    path: str
    size: int


class FileReadResponse(TypedDict, total=False):
    status: ToolStatus
    message: str
    content: str
    path: str
    offset: int
    limit: int
    total_lines: int


class FileEditResponse(TypedDict, total=False):
    status: ToolStatus
    message: str
    path: str
    replacements: int
    available_matches: int
    size: int


class SearchResultItem(TypedDict):
    title: str
    url: str
    content: str
    score: float


class SearchSourceItem(TypedDict):
    title: str
    url: str


class SearchCompactResult(TypedDict):
    title: str
    url: str
    snippet: str


class TavilySearchResponse(TypedDict, total=False):
    status: ToolStatus
    query: str
    answer: str
    results: list[SearchResultItem]
    message: str


class WebSearchResponse(TypedDict, total=False):
    status: ToolStatus
    query: str
    summarize: bool
    topic: str | None
    summary: str
    sources: list[SearchSourceItem]
    results: list[SearchCompactResult]
    message: str


class WebFetchResponse(TypedDict, total=False):
    status: ToolStatus
    url: str
    status_code: int
    content_type: str
    markdown: str
    size: int
    truncated: bool
    message: str


class ActivateSkillResponse(TypedDict, total=False):
    status: ToolStatus
    message: str
    skill_name: str
    description: str
    skill_guide: str
    skill_base_dir: str
    available_skills: list[str]


class ShellToolResponse(TypedDict, total=False):
    status: ToolStatus
    stdout: str
    stderr: str
    exit_code: int
    message: str
