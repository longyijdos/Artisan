"""Skill management endpoints."""

import logging
import re

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from schemas.skills import (
    SkillListResponse,
    SkillModel,
    SkillMutationRequest,
    SkillMutationResponse,
    SkillUploadResponse,
    normalize_skill_mutation_request,
)
from services.skills import (
    SkillNotFoundError,
    SkillProtectedError,
    SkillSandboxNotFoundError,
    SkillServiceError,
    install_skill as _install_skill,
    list_skills as _list_skills,
    uninstall_skill as _uninstall_skill,
    upload_skill as _upload_skill,
)
from utils.skills import extract_skill_name

logger = logging.getLogger(__name__)

skills_router = APIRouter(prefix="/skills", tags=["skills"])


@skills_router.get("/list/{thread_id}", response_model=SkillListResponse)
async def list_skills(thread_id: str):
    """List all available skills and their status for a specific thread's sandbox."""
    try:
        normalized_thread_id = thread_id.strip()
        if not normalized_thread_id:
            raise HTTPException(status_code=400, detail="thread_id is required")
        skills = await _list_skills(normalized_thread_id)
        return SkillListResponse(skills=[SkillModel(**skill) for skill in skills])
    except HTTPException:
        raise
    except SkillSandboxNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Error listing skills for thread %s", thread_id)
        raise HTTPException(status_code=500, detail="Failed to list skills") from e


@skills_router.post("/install")
async def install_skill(req: SkillMutationRequest):
    """Install (enable) a skill."""
    normalized = None
    try:
        normalized = normalize_skill_mutation_request(req)
        await _install_skill(normalized.thread_id, normalized.skill_name)
        response: SkillMutationResponse = {
            "success": True,
            "message": f"Skill '{normalized.skill_name}' installed",
            "skill_name": normalized.skill_name,
        }
        return response
    except HTTPException:
        raise
    except (SkillNotFoundError, SkillSandboxNotFoundError) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception(
            "Error installing skill %s for thread %s",
            normalized.skill_name if normalized else req.skill_name,
            normalized.thread_id if normalized else req.thread_id,
        )
        raise HTTPException(status_code=500, detail="Failed to install skill") from e


@skills_router.post("/uninstall")
async def uninstall_skill(req: SkillMutationRequest):
    """Uninstall (disable) a skill."""
    normalized = None
    try:
        normalized = normalize_skill_mutation_request(req)
        await _uninstall_skill(normalized.thread_id, normalized.skill_name)
        response: SkillMutationResponse = {
            "success": True,
            "message": f"Skill '{normalized.skill_name}' uninstalled",
            "skill_name": normalized.skill_name,
        }
        return response
    except HTTPException:
        raise
    except SkillProtectedError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (SkillNotFoundError, SkillSandboxNotFoundError) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception(
            "Error uninstalling skill %s for thread %s",
            normalized.skill_name if normalized else req.skill_name,
            normalized.thread_id if normalized else req.thread_id,
        )
        raise HTTPException(status_code=500, detail="Failed to uninstall skill") from e


_SAFE_NAME_RE = re.compile(r"^[a-zA-Z0-9_\-]+$")


@skills_router.post("/upload")
async def upload_skill(
    thread_id: str = Form(...),
    skill_name: str = Form(""),
    folder_name: str = Form(""),
    files: list[UploadFile] = File(...),
):
    """Upload a custom skill (folder contents or single SKILL.md)."""
    try:
        # -- Collect files into {relative_path: bytes} -------------------------
        collected: dict[str, bytes] = {}

        for f in files:
            content = await f.read()
            fname = f.filename or "SKILL.md"
            collected[fname] = content

        if not collected:
            raise HTTPException(status_code=400, detail="No files provided")

        # -- Validate: must contain SKILL.md -----------------------------------
        has_skill_md = any(
            path.upper() == "SKILL.MD" or path.upper().endswith("/SKILL.MD")
            for path in collected
        )
        if not has_skill_md:
            raise HTTPException(
                status_code=400,
                detail="上传的文件中必须包含 SKILL.md",
            )

        # -- Determine skill_name ------------------------------------------------
        resolved_name = skill_name.strip() if skill_name else ""

        if not resolved_name:
            # Try extracting from SKILL.md frontmatter
            for path, content in collected.items():
                if path.upper() == "SKILL.MD" or path.upper().endswith("/SKILL.MD"):
                    resolved_name = extract_skill_name(content.decode("utf-8"))
                    break

        if not resolved_name:
            # Fall back to the original folder name sent by the frontend
            resolved_name = folder_name.strip()

        # Sanitize: only allow safe chars
        resolved_name = resolved_name.strip().replace(" ", "-")
        if not resolved_name or not _SAFE_NAME_RE.match(resolved_name):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid skill name '{resolved_name}'. Use only letters, numbers, hyphens, and underscores.",
            )

        # -- Delegate to service -------------------------------------------------
        await _upload_skill(thread_id.strip(), resolved_name, collected)

        response: SkillUploadResponse = {
            "success": True,
            "message": f"Skill '{resolved_name}' uploaded and installed",
            "skill_name": resolved_name,
        }
        return response

    except HTTPException:
        raise
    except SkillSandboxNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except SkillServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Error uploading skill for thread %s", thread_id)
        raise HTTPException(status_code=500, detail="Failed to upload skill") from e
