export type JsonPrimitive = string | number | boolean | null;

export interface JsonObject {
  [key: string]: JsonValue;
}

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type ChatToolArgsContract = JsonObject;
export type ChatToolResultContract = JsonValue;

export interface ChatAttachmentContract {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType?: string;
}

export interface ChatRunRouteRequestBody {
  threadId?: string;
  message?: string;
  toolCallId?: string;
  toolResult?: ChatToolResultContract;
  reasoningMode?: boolean;
  knowledgeSourceIds?: number[];
  attachments?: ChatAttachmentContract[];
}

export interface AgentChatRunRequestBody {
  thread_id: string;
  run_id: string;
  message?: string;
  tool_call_id?: string;
  tool_result?: ChatToolResultContract;
  reasoning_mode: boolean;
  knowledge_source_ids: number[];
  attachments: ChatAttachmentContract[];
}

export interface ChatHistoryToolCallFunctionContract {
  name?: string;
  arguments?: string;
}

export interface ChatHistoryToolCallContract {
  id?: string;
  name?: string;
  args?: JsonValue;
  function?: ChatHistoryToolCallFunctionContract;
}

export interface ChatHistoryMessageContract {
  id?: string;
  role?: string;
  content?: JsonValue;
  tool_calls?: ChatHistoryToolCallContract[];
  tool_call_id?: string;
  reasoning_content?: string;
  attachments?: ChatAttachmentContract[];
}

export interface ChatHistoryPagingContract {
  total?: number;
  before?: number | null;
  next_before?: number | null;
  limit?: number;
  has_more?: boolean;
}

export interface ChatHistoryResponseContract {
  messages?: ChatHistoryMessageContract[];
  paging?: ChatHistoryPagingContract;
}

export interface ChatStopRouteRequestBody {
  threadId?: string;
}

export interface AgentChatStopRequestBody {
  thread_id: string | null;
}

export interface ChatStopRouteResponse {
  ok: boolean;
  stopped: number;
  threadId: string | null;
}

interface BaseChatStreamEventContract {
  type: string;
}

export interface RunStartedEventContract extends BaseChatStreamEventContract {
  type: "RUN_STARTED";
  runId?: string;
  threadId?: string;
}

export interface RunFinishedEventContract extends BaseChatStreamEventContract {
  type: "RUN_FINISHED";
  runId?: string;
  threadId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  contextWindow?: number;
}

export interface TextMessageStartEventContract extends BaseChatStreamEventContract {
  type: "TEXT_MESSAGE_START";
  messageId?: string;
  role?: string;
  content?: string;
}

export interface TextMessageContentEventContract extends BaseChatStreamEventContract {
  type: "TEXT_MESSAGE_CONTENT";
  messageId?: string;
  delta?: string;
  content?: string;
}

export interface TextMessageEndEventContract extends BaseChatStreamEventContract {
  type: "TEXT_MESSAGE_END";
  messageId?: string;
}

export interface ReasoningStartEventContract extends BaseChatStreamEventContract {
  type: "REASONING_START";
  messageId?: string;
}

export interface ReasoningContentEventContract extends BaseChatStreamEventContract {
  type: "REASONING_CONTENT";
  messageId?: string;
  delta?: string;
  content?: string;
}

export interface ReasoningEndEventContract extends BaseChatStreamEventContract {
  type: "REASONING_END";
  messageId?: string;
}

export interface ToolCallStartEventContract extends BaseChatStreamEventContract {
  type: "TOOL_CALL_START";
  messageId?: string;
  toolCallId?: string;
  toolName?: string;
  args?: JsonValue;
}

export interface ToolCallArgsDeltaEventContract extends BaseChatStreamEventContract {
  type: "TOOL_CALL_ARGS_DELTA";
  toolCallId?: string;
  toolName?: string;
  argsDelta?: string;
}

export interface ToolCallEndEventContract extends BaseChatStreamEventContract {
  type: "TOOL_CALL_END";
  messageId?: string;
  toolCallId?: string;
  toolName?: string;
  args?: JsonValue;
  result?: JsonValue;
}

export interface RunErrorEventContract extends BaseChatStreamEventContract {
  type: "RUN_ERROR";
  runId?: string;
  threadId?: string;
  error?: string;
  message?: string;
}

export type ChatStreamEventContract =
  | RunStartedEventContract
  | RunFinishedEventContract
  | TextMessageStartEventContract
  | TextMessageContentEventContract
  | TextMessageEndEventContract
  | ReasoningStartEventContract
  | ReasoningContentEventContract
  | ReasoningEndEventContract
  | ToolCallStartEventContract
  | ToolCallArgsDeltaEventContract
  | ToolCallEndEventContract
  | RunErrorEventContract
  | BaseChatStreamEventContract;

export function isJsonObject(
  value: JsonValue | object | undefined,
): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: JsonValue | object | undefined): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item));
  }

  if (isJsonObject(value)) {
    return Object.values(value).every((item) => isJsonValue(item));
  }

  return false;
}

function getStringField(
  value: JsonObject,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const field = value[key];
    if (typeof field === "string") {
      return field;
    }
  }
  return undefined;
}

function getNumberField(
  value: JsonObject,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const field = value[key];
    if (typeof field === "number") {
      return field;
    }
  }
  return undefined;
}

function getJsonValueField(
  value: JsonObject,
  ...keys: string[]
): JsonValue | undefined {
  for (const key of keys) {
    const field = value[key];
    if (isJsonValue(field)) {
      return field;
    }
  }
  return undefined;
}

export function parseChatStreamEvent(
  value: JsonValue | object | undefined,
): ChatStreamEventContract | null {
  if (!isJsonObject(value)) {
    return null;
  }

  const rawType = getStringField(value, "type");
  if (!rawType) {
    return null;
  }

  const type = rawType.toUpperCase();

  switch (type) {
    case "RUN_STARTED":
      return {
        type,
        runId: getStringField(value, "runId", "run_id"),
        threadId: getStringField(value, "threadId", "thread_id"),
      };
    case "RUN_FINISHED":
      return {
        type,
        runId: getStringField(value, "runId", "run_id"),
        threadId: getStringField(value, "threadId", "thread_id"),
        inputTokens: getNumberField(value, "inputTokens", "input_tokens"),
        outputTokens: getNumberField(value, "outputTokens", "output_tokens"),
        totalTokens: getNumberField(value, "totalTokens", "total_tokens"),
        contextWindow: getNumberField(value, "contextWindow", "context_window"),
      };
    case "TEXT_MESSAGE_START":
      return {
        type,
        messageId: getStringField(value, "messageId", "message_id"),
        role: getStringField(value, "role"),
        content: getStringField(value, "content"),
      };
    case "TEXT_MESSAGE_CONTENT":
      return {
        type,
        messageId: getStringField(value, "messageId", "message_id"),
        delta: getStringField(value, "delta"),
        content: getStringField(value, "content"),
      };
    case "TEXT_MESSAGE_END":
      return {
        type,
        messageId: getStringField(value, "messageId", "message_id"),
      };
    case "REASONING_START":
      return {
        type,
        messageId: getStringField(value, "messageId", "message_id"),
      };
    case "REASONING_CONTENT":
      return {
        type,
        messageId: getStringField(value, "messageId", "message_id"),
        delta: getStringField(value, "delta"),
        content: getStringField(value, "content"),
      };
    case "REASONING_END":
      return {
        type,
        messageId: getStringField(value, "messageId", "message_id"),
      };
    case "TOOL_CALL_START":
      return {
        type,
        messageId: getStringField(value, "messageId", "message_id"),
        toolCallId: getStringField(value, "toolCallId", "tool_call_id"),
        toolName: getStringField(value, "toolName", "tool_name"),
        args: getJsonValueField(value, "args", "arguments"),
      };
    case "TOOL_CALL_ARGS_DELTA":
      return {
        type,
        toolCallId: getStringField(value, "toolCallId", "tool_call_id"),
        toolName: getStringField(value, "toolName", "tool_name"),
        argsDelta: getStringField(value, "argsDelta", "args_delta"),
      };
    case "TOOL_CALL_END":
      return {
        type,
        messageId: getStringField(value, "messageId", "message_id"),
        toolCallId: getStringField(value, "toolCallId", "tool_call_id"),
        toolName: getStringField(value, "toolName", "tool_name"),
        args: getJsonValueField(value, "args", "arguments"),
        result: getJsonValueField(value, "result"),
      };
    case "RUN_ERROR":
      return {
        type,
        runId: getStringField(value, "runId", "run_id"),
        threadId: getStringField(value, "threadId", "thread_id"),
        error: getStringField(value, "error"),
        message: getStringField(value, "message"),
      };
    default:
      return { type };
  }
}
