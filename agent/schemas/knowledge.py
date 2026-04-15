"""Contracts for knowledge-base HTTP payloads."""

from pydantic import BaseModel


class KnowledgeIndexRequest(BaseModel):
    path: str
    is_dir: bool = False
    thread_id: str
    force: bool = False


class KnowledgeCheckRequest(BaseModel):
    path: str
    is_dir: bool = False


class KnowledgeCheckResponse(BaseModel):
    exists: bool
    source_ids: list[int] = []
    name: str = ""


class KnowledgeIndexResultItem(BaseModel):
    source_id: int
    name: str
    source_type: str
    chunk_count: int


class KnowledgeIndexResponse(BaseModel):
    success: bool
    message: str
    results: list[KnowledgeIndexResultItem] = []


class KnowledgeSourceItem(BaseModel):
    id: int
    name: str
    source_type: str
    chunk_count: int
    created_at: str


class KnowledgeListResponse(BaseModel):
    sources: list[KnowledgeSourceItem]


class KnowledgeDeleteResponse(BaseModel):
    success: bool
    message: str
