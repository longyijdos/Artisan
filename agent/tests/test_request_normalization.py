import pytest
from fastapi import HTTPException

from schemas.sessions import SessionAutonameRequest, normalize_autoname_request
from schemas.skills import SkillMutationRequest, normalize_skill_mutation_request


def test_normalize_autoname_request_trims_message() -> None:
    normalized = normalize_autoname_request(
        SessionAutonameRequest(message="  给我起个标题  ")
    )

    assert normalized.message == "给我起个标题"


def test_normalize_autoname_request_rejects_blank_message() -> None:
    with pytest.raises(HTTPException) as exc_info:
        normalize_autoname_request(SessionAutonameRequest(message="   "))

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "message is required"


def test_normalize_skill_mutation_request_trims_fields() -> None:
    normalized = normalize_skill_mutation_request(
        SkillMutationRequest(
            skill_name="  github  ",
            thread_id="  thread-1  ",
        )
    )

    assert normalized.skill_name == "github"
    assert normalized.thread_id == "thread-1"


@pytest.mark.parametrize(
    ("payload", "detail"),
    [
        (SkillMutationRequest(skill_name="github", thread_id="   "), "thread_id is required"),
        (SkillMutationRequest(skill_name="   ", thread_id="thread-1"), "skill_name is required"),
    ],
)
def test_normalize_skill_mutation_request_rejects_blank_fields(
    payload: SkillMutationRequest,
    detail: str,
) -> None:
    with pytest.raises(HTTPException) as exc_info:
        normalize_skill_mutation_request(payload)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == detail
