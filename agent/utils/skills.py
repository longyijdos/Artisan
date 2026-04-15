"""Skill system utility functions."""

from collections.abc import Sequence
from typing import TypedDict

import frontmatter

from sandbox import ActiveSkillDetail


class SkillFrontmatter(TypedDict, total=False):
    description: str


def extract_skill_frontmatter(content: str) -> SkillFrontmatter:
    """
    Extract and parse YAML frontmatter from SKILL.md content.
    
    Args:
        content: The full content of a SKILL.md file.
        
    Returns:
        A dictionary containing the parsed frontmatter, or empty dict if not found/invalid.
    """
    try:
        post = frontmatter.loads(content)
        description = post.metadata.get("description")
        if isinstance(description, str):
            return {"description": description}
        return {}
    except Exception:
        return {}

def extract_skill_name(content: str) -> str:
    """
    Extract the skill name from SKILL.md frontmatter.

    Args:
        content: The full content of a SKILL.md file.

    Returns:
        The name string, or empty string if not found.
    """
    try:
        post = frontmatter.loads(content)
        name = post.metadata.get("name")
        if isinstance(name, str) and name.strip():
            return name.strip()
    except Exception:
        pass
    return ""


def extract_skill_description(content: str) -> str:
    """
    Extract just the description from SKILL.md content.
    
    Args:
        content: The full content of a SKILL.md file.
        
    Returns:
        The description string, or empty string if not found.
    """
    data = extract_skill_frontmatter(content)
    return data.get("description", "")

def extract_skill_body(content: str) -> str:
    """
    Extract the body content (markdown) from SKILL.md, removing frontmatter.
    
    Args:
        content: The full content of a SKILL.md file.
        
    Returns:
        The markdown body content.
    """
    try:
        post = frontmatter.loads(content)
        return post.content.strip()
    except Exception:
        return content.strip()

def generate_skills_prompt_section(active_skills: Sequence[ActiveSkillDetail]) -> str:
    """
    Generate the skills prompt section, including only enabled skills.
    
    Args:
        active_skills: List of enabled skills, each element is {"name": "...", "description": "..."}
        
    Returns:
        Prompt text containing available skill index
    """
    if not active_skills:
        return ""
    
    lines = [
        "",
        "## 可用技能 (Skills)",
        "",
        "以下是可用的技能列表。当任务涉及某个技能时，使用 `activate_skill` 工具激活它以获取详细指南。",
        "",
    ]
    
    # Directly use passed details
    for skill in active_skills:
        name = skill.get("name", "")
        desc = skill.get("description", "")
        
        if name:
            if desc:
                 lines.append(f"- **{name}**: {desc}")
            else:
                 lines.append(f"- **{name}**")
    
    lines.append("")
    lines.append("使用 `activate_skill(skill_name)` 激活技能后，你将获得该技能的完整使用指南。")
    lines.append("")
    
    return "\n".join(lines)
