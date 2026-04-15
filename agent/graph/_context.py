"""Context helpers for graph execution."""

from __future__ import annotations

from langchain_core.runnables import RunnableConfig

from sandbox import ActiveSkillDetail, DaytonaClient
from schemas.chat import ChatAttachmentPayload
from utils.db import get_sandbox_id_for_thread


def get_configurable(config: RunnableConfig) -> dict[str, object]:
    configurable = config.get("configurable", {})
    return configurable if isinstance(configurable, dict) else {}


def normalize_attachments(raw_attachments: object) -> list[ChatAttachmentPayload]:
    if not isinstance(raw_attachments, list):
        return []

    normalized: list[ChatAttachmentPayload] = []
    for item in raw_attachments:
        if not isinstance(item, dict):
            continue
        path = item.get("path")
        if not isinstance(path, str) or not path.strip():
            continue
        attachment: ChatAttachmentPayload = {"path": path}
        identifier = item.get("id")
        if isinstance(identifier, str) and identifier.strip():
            attachment["id"] = identifier
        name = item.get("name")
        if isinstance(name, str):
            attachment["name"] = name
        size = item.get("size")
        if isinstance(size, int):
            attachment["size"] = size
        mime_type = item.get("mimeType")
        if isinstance(mime_type, str):
            attachment["mimeType"] = mime_type
        normalized.append(attachment)
    return normalized


def build_attachment_context(attachments: list[ChatAttachmentPayload]) -> str:
    if not attachments:
        return ""

    lines = ["User uploaded files for this turn (workspace paths):"]
    for attachment in attachments[:20]:
        path = str(attachment.get("path", "")).strip()
        name = str(attachment.get("name", "")).strip()
        size = attachment.get("size")
        if not path:
            continue
        size_part = f", size={size} bytes" if isinstance(size, int) else ""
        lines.append(f"- {path} (name={name or 'unknown'}{size_part})")

    if len(lines) == 1:
        return ""

    lines.append("If file content is needed, call read_file on these paths.")
    return "\n".join(lines)


async def load_active_skills(thread_id: str | None) -> list[ActiveSkillDetail]:
    if not thread_id:
        return []

    try:
        sandbox_id = await get_sandbox_id_for_thread(thread_id)
        if not sandbox_id:
            return []

        client = DaytonaClient()
        return await client.get_active_skills_with_details(sandbox_id)
    except Exception:
        return []
