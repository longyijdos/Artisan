from importlib import import_module

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


def _sessions_router_module():
    return import_module("routers.sessions")


def _skills_router_module():
    return import_module("routers.skills")


def _skills_service_module():
    return import_module("services.skills")


def _build_test_client(*, include_sessions: bool = False, include_skills: bool = False) -> TestClient:
    app = FastAPI()
    if include_sessions:
        app.include_router(_sessions_router_module().router)
    if include_skills:
        app.include_router(_skills_router_module().skills_router)
    return TestClient(app)


def test_sessions_autoname_rejects_blank_message() -> None:
    client = _build_test_client(include_sessions=True)

    response = client.post("/sessions/autoname", json={"message": "   "})

    assert response.status_code == 400
    assert response.json() == {"detail": "message is required"}


def test_sessions_autoname_returns_internal_error_detail(monkeypatch: pytest.MonkeyPatch) -> None:
    sessions_router_module = _sessions_router_module()

    async def _raise_error(_: str) -> str | None:
        raise RuntimeError("llm offline")

    monkeypatch.setattr(sessions_router_module, "autoname_from_message", _raise_error)
    client = _build_test_client(include_sessions=True)

    response = client.post("/sessions/autoname", json={"message": "hello"})

    assert response.status_code == 500
    assert response.json() == {"detail": "Failed to auto-name session"}


def test_skills_install_rejects_blank_fields() -> None:
    client = _build_test_client(include_skills=True)

    response = client.post(
        "/skills/install",
        json={"thread_id": "thread-1", "skill_name": "   "},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "skill_name is required"}


def test_skills_install_returns_success_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    skills_router_module = _skills_router_module()

    async def _install_skill(thread_id: str, skill_name: str) -> None:
        assert thread_id == "thread-1"
        assert skill_name == "github"

    monkeypatch.setattr(skills_router_module, "_install_skill", _install_skill)
    client = _build_test_client(include_skills=True)

    response = client.post(
        "/skills/install",
        json={"thread_id": "thread-1", "skill_name": "github"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "message": "Skill 'github' installed",
        "skill_name": "github",
    }


def test_skills_uninstall_maps_protected_error_to_bad_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    skills_router_module = _skills_router_module()
    skills_service_module = _skills_service_module()

    async def _uninstall_skill(_: str, __: str) -> None:
        raise skills_service_module.SkillProtectedError("Cannot disable core skill: github")

    monkeypatch.setattr(skills_router_module, "_uninstall_skill", _uninstall_skill)
    client = _build_test_client(include_skills=True)

    response = client.post(
        "/skills/uninstall",
        json={"thread_id": "thread-1", "skill_name": "github"},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Cannot disable core skill: github"}


def test_skills_list_maps_missing_sandbox_to_not_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    skills_router_module = _skills_router_module()
    skills_service_module = _skills_service_module()

    async def _list_skills(_: str) -> list[dict[str, str]]:
        raise skills_service_module.SkillSandboxNotFoundError(
            "No session sandbox found for this thread"
        )

    monkeypatch.setattr(skills_router_module, "_list_skills", _list_skills)
    client = _build_test_client(include_skills=True)

    response = client.get("/skills/list/thread-1")

    assert response.status_code == 404
    assert response.json() == {"detail": "No session sandbox found for this thread"}
