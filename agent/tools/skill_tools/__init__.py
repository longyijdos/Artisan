"""Skill management tools for the agent."""

from .skills import activate_skill

SKILL_TOOLS = [activate_skill]

__all__ = ["activate_skill", "SKILL_TOOLS"]
