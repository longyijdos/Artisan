"""Skill activation tool implementations."""

from __future__ import annotations

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

from sandbox import DaytonaClient
from tools._runtime import resolve_sandbox_id
from tools._types import ActivateSkillResponse
from utils.skills import extract_skill_body, extract_skill_description


@tool
async def activate_skill(
    skill_name: str,
    config: RunnableConfig,
    **kwargs,
) -> ActivateSkillResponse:
    """
    Activate a skill and get its full usage guide.

    Use this when you need to perform a domain-specific task (e.g., image generation,
    GitHub operations, etc.). Activating a skill provides detailed instructions and
    script paths for completing the task.

    Args:
        skill_name: The skill name (e.g., "openai-image-gen", "github", "tmux")
    """
    try:
        sandbox_id = await resolve_sandbox_id(config)
        if not sandbox_id:
            return {
                "status": "error",
                "message": "No session sandbox found",
                "skill_name": skill_name,
            }

        client = DaytonaClient()
        skills_dir = await client.get_skills_directory(sandbox_id)
        skill_path = f"{skills_dir}/{skill_name}/SKILL.md"

        try:
            content = await client.read_file(sandbox_id, skill_path)
        except Exception as e:
            try:
                available = await client.list_files(sandbox_id, skills_dir)
                skill_names = [entry["name"] for entry in available if entry["is_dir"]]
                return {
                    "status": "error",
                    "message": (
                        f"Skill '{skill_name}' not found. Available skills: {', '.join(skill_names)}"
                    ),
                    "skill_name": skill_name,
                    "available_skills": skill_names,
                }
            except Exception:
                return {
                    "status": "error",
                    "message": f"Skill '{skill_name}' not found: {str(e)}",
                    "skill_name": skill_name,
                }

        body = extract_skill_body(content)
        description = extract_skill_description(content)

        return {
            "status": "success",
            "skill_name": skill_name,
            "description": description,
            "skill_guide": body,
            "skill_base_dir": f"{skills_dir}/{skill_name}",
            "message": (
                f"Skill '{skill_name}' activated. "
                f"The guide uses relative paths — resolve them against skill_base_dir ({skills_dir}/{skill_name})."
            ),
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to activate skill: {str(e)}",
            "skill_name": skill_name,
        }
