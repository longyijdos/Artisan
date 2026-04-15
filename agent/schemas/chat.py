"""Contracts for chat-related HTTP payloads."""

import uuid
from dataclasses import dataclass
from typing import Literal, NotRequired, TypeAlias, TypedDict

from fastapi import HTTPException
from pydantic import BaseModel

JsonPrimitive: TypeAlias = str | int | float | bool | None
JsonValue: TypeAlias = JsonPrimitive | list[object] | dict[str, object]
JsonObject: TypeAlias = dict[str, object]


class ChatAttachmentPayload(TypedDict, total=False):
    id: str
    name: str
    path: str
    size: int
    mimeType: str


class ChatToolCallFunctionPayload(TypedDict, total=False):
    name: str
    arguments: str


class ChatHistoryToolCallPayload(TypedDict, total=False):
    id: str
    type: Literal["function"]
    function: ChatToolCallFunctionPayload


class ChatHistoryMessagePayload(TypedDict, total=False):
    id: str
    role: str
    content: JsonValue | str
    tool_calls: list[ChatHistoryToolCallPayload]
    tool_call_id: str
    reasoning_content: str
    attachments: list[ChatAttachmentPayload]


class ChatSseEventPayload(TypedDict, total=False):
    type: str
    runId: str
    threadId: str
    messageId: str
    role: str
    delta: str
    toolCallId: str
    toolName: str
    args: JsonObject
    argsDelta: str
    result: object
    error: str
    message: str
    inputTokens: int
    outputTokens: int
    totalTokens: int
    contextWindow: int


class ChatRunRequest(BaseModel):
    thread_id: str
    message: str | None = None
    tool_call_id: str | None = None
    tool_result: JsonValue | None = None
    run_id: str | None = None
    reasoning_mode: bool | None = None
    knowledge_source_ids: list[int] | None = None
    attachments: list[ChatAttachmentPayload] | None = None


class ChatStopRequest(BaseModel):
    thread_id: str | None = None


@dataclass(frozen=True, slots=True)
class NormalizedChatRunRequest:
    thread_id: str
    message: str
    tool_call_id: str
    tool_result: JsonValue | None
    has_tool_result: bool
    run_id: str
    reasoning_mode: bool
    knowledge_source_ids: list[int]
    attachments: list[ChatAttachmentPayload]


class ChatHistoryPaging(TypedDict):
    total: int
    before: int | None
    next_before: int | None
    limit: int
    has_more: bool


class ChatHistoryResponse(TypedDict):
    messages: list[ChatHistoryMessagePayload]
    paging: NotRequired[ChatHistoryPaging]


class ChatStopResponse(TypedDict):
    ok: bool
    stopped: int
    thread_id: str | None


def normalize_chat_run_request(
    request_payload: ChatRunRequest,
) -> NormalizedChatRunRequest:
    thread_id = request_payload.thread_id.strip()
    message = (
        request_payload.message.strip()
        if isinstance(request_payload.message, str)
        else ""
    )
    tool_call_id = (
        request_payload.tool_call_id.strip()
        if isinstance(request_payload.tool_call_id, str)
        else ""
    )
    tool_result = request_payload.tool_result
    has_tool_result = tool_result is not None
    reasoning_mode = (
        bool(request_payload.reasoning_mode)
        if request_payload.reasoning_mode is not None
        else False
    )
    knowledge_source_ids = (
        request_payload.knowledge_source_ids
        if isinstance(request_payload.knowledge_source_ids, list)
        else []
    )
    attachments = (
        request_payload.attachments
        if isinstance(request_payload.attachments, list)
        else []
    )
    run_id = request_payload.run_id or f"run-{uuid.uuid4()}"

    if not thread_id:
        raise HTTPException(status_code=400, detail="thread_id is required")
    if not message and not (tool_call_id and has_tool_result):
        raise HTTPException(
            status_code=400,
            detail="message is required, or provide tool_call_id and tool_result",
        )

    return NormalizedChatRunRequest(
        thread_id=thread_id,
        message=message,
        tool_call_id=tool_call_id,
        tool_result=tool_result,
        has_tool_result=has_tool_result,
        run_id=run_id,
        reasoning_mode=reasoning_mode,
        knowledge_source_ids=knowledge_source_ids,
        attachments=attachments,
    )


def normalize_stop_thread_id(request_payload: ChatStopRequest) -> str | None:
    raw_thread_id = request_payload.thread_id
    if isinstance(raw_thread_id, str):
        thread_id = raw_thread_id.strip()
        if not thread_id:
            raise HTTPException(status_code=400, detail="thread_id must not be empty")
        return thread_id
    return None
