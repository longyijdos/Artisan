"""Frontend-driven tool schemas."""

from __future__ import annotations

from typing import Literal

from langchain_core.tools import tool
from pydantic import BaseModel, Field


class AskUserTextField(BaseModel):
    """Free-form text input field."""

    name: str = Field(description="Field name, shown as label and used as key in submitted data.")
    type: Literal["text"] = Field(
        default="text",
        description="Must be 'text'.",
    )
    placeholder: str | None = Field(
        default=None,
        description="Placeholder text shown in the input.",
    )
    required: bool = Field(
        default=True,
        description="Whether this field is required before submission.",
    )


class AskUserSelectField(BaseModel):
    """Dropdown select field."""

    name: str = Field(description="Field name, shown as label and used as key in submitted data.")
    type: Literal["select"] = Field(
        description="Must be 'select'.",
    )
    options: list[str] = Field(
        description="List of choices for the dropdown.",
    )
    required: bool = Field(
        default=True,
        description="Whether this field is required before submission.",
    )


AskUserField = AskUserTextField | AskUserSelectField


class AskUserInput(BaseModel):
    """Arguments for ask_user frontend tool."""

    title: str = Field(
        description="Title shown above the input form, e.g. 'Please provide API key'.",
    )
    fields: list[AskUserField] = Field(
        description="Form fields to ask the user. Each field is either a text input or a select dropdown.",
    )


class UpdatePlanItem(BaseModel):
    """Single plan step entry."""

    step: str = Field(description="Step description.")
    status: Literal["pending", "in_progress", "completed"] = Field(
        default="pending",
        description="Step status.",
    )


class UpdatePlanInput(BaseModel):
    """Arguments for update_plan frontend tool."""

    explanation: str | None = Field(
        default=None,
        description="Optional short explanation shown above plan list.",
    )
    plan: list[UpdatePlanItem] = Field(
        description="Plan steps and statuses.",
    )


@tool("ask_user", args_schema=AskUserInput)
def ask_user(title: str, fields: list[dict], **kwargs):
    """Ask user for information when the agent lacks critical details."""
    return {"status": "frontend", "title": title, "fields": fields}


@tool("update_plan", args_schema=UpdatePlanInput)
def update_plan(explanation: str | None = None, plan: list[dict] | None = None, **kwargs):
    """Update visible execution plan in frontend UI."""
    return {"status": "frontend", "explanation": explanation, "plan": plan or []}
