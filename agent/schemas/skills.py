"""Contracts for skill-related HTTP payloads."""

from dataclasses import dataclass
from typing import Literal, TypedDict

from fastapi import HTTPException
from pydantic import BaseModel

SkillStatus = Literal["core", "installed", "available"]


class SkillPayload(TypedDict):
    name: str
    status: SkillStatus
    description: str


class SkillModel(BaseModel):
    name: str
    status: SkillStatus
    description: str


class SkillListResponse(BaseModel):
    skills: list[SkillModel]


class SkillMutationRequest(BaseModel):
    skill_name: str
    thread_id: str


@dataclass(frozen=True, slots=True)
class NormalizedSkillMutationRequest:
    skill_name: str
    thread_id: str


class SkillMutationResponse(TypedDict):
    success: bool
    message: str
    skill_name: str


class SkillUploadResponse(TypedDict):
    success: bool
    message: str
    skill_name: str


def normalize_skill_mutation_request(
    request_payload: SkillMutationRequest,
) -> NormalizedSkillMutationRequest:
    skill_name = request_payload.skill_name.strip()
    thread_id = request_payload.thread_id.strip()

    if not thread_id:
        raise HTTPException(status_code=400, detail="thread_id is required")
    if not skill_name:
        raise HTTPException(status_code=400, detail="skill_name is required")

    return NormalizedSkillMutationRequest(
        skill_name=skill_name,
        thread_id=thread_id,
    )
