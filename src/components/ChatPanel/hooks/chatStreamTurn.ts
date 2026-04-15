import type { Dispatch, SetStateAction } from "react";
import type { ChatStreamEventContract } from "@/lib/chat/contracts";
import type { ChatRunPayload, ChatTimelineItem, ChatToolCallItem } from "../types";
import { MIN_TOOL_LOADING_MS } from "../types";
import {
  appendTimelineItem,
  buildAutoToolResult,
  finalizeTimelineAfterRun,
  isFrontendToolName,
  normalizeToolArgs,
  normalizeToolResult,
  resolveToolStatus,
  shouldAutoResumeFrontendTool,
  upsertTextMessage,
  upsertToolCall,
} from "../utils";
import { readChatStreamEvents } from "./chatStreamTransport";
import type { UseChatStreamBuffersReturn } from "./useChatStreamBuffers";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextWindow: number;
}

interface RunChatStreamTurnOptions {
  threadIdForRun: string;
  payload: ChatRunPayload;
  controller: AbortController;
  setTimeline: Dispatch<SetStateAction<ChatTimelineItem[]>>;
  buffers: UseChatStreamBuffersReturn;
  onTokenUsage?: (usage: TokenUsage) => void;
}

interface RunChatStreamTurnResult {
  aborted: boolean;
  runHasError: boolean;
  pendingAutoResume: ChatRunPayload[];
}

interface StreamTurnState {
  activeAssistantId: string;
  autoResumeToolIds: Set<string>;
  pendingAutoResume: ChatRunPayload[];
  runHasError: boolean;
  reasoningMode: boolean;
  toolLoadingStartedAt: Map<string, number>;
}

interface StreamTurnContext {
  controller: AbortController;
  setTimeline: Dispatch<SetStateAction<ChatTimelineItem[]>>;
  buffers: UseChatStreamBuffersReturn;
  state: StreamTurnState;
  onTokenUsage?: (usage: TokenUsage) => void;
}

function upsertAssistantError(
  setTimeline: Dispatch<SetStateAction<ChatTimelineItem[]>>,
  assistantId: string,
  errorText: string,
): void {
  setTimeline((prev) => {
    const existing = prev.find(
      (item) => item.kind === "text" && item.id === assistantId,
    );
    const content =
      existing && existing.kind === "text" ? existing.content : "";
    const nextContent = content
      ? `${content}\n\n[错误] ${errorText}`
      : `[错误] ${errorText}`;

    return upsertTextMessage(prev, {
      kind: "text",
      id: assistantId,
      role: "assistant",
      content: nextContent,
      status: "error",
    });
  });
}

function appendRequestError(
  setTimeline: Dispatch<SetStateAction<ChatTimelineItem[]>>,
  assistantId: string,
  messageText: string,
): void {
  setTimeline((prev) => {
    const existing = prev.find(
      (item) => item.kind === "text" && item.id === assistantId,
    );
    if (existing && existing.kind === "text") {
      return upsertTextMessage(prev, {
        ...existing,
        content: existing.content
          ? `${existing.content}\n\n[错误] ${messageText}`
          : `[错误] ${messageText}`,
        status: "error",
      });
    }

    return appendTimelineItem(prev, {
      kind: "text",
      id: assistantId,
      role: "assistant",
      content: `[错误] ${messageText}`,
      status: "error",
    });
  });
}

function getEventMessageId(event: ChatStreamEventContract): string | undefined {
  return "messageId" in event ? event.messageId : undefined;
}

function getToolCallId(event: ChatStreamEventContract): string {
  return "toolCallId" in event && event.toolCallId ? event.toolCallId : "";
}

function getToolName(event: ChatStreamEventContract): string {
  return "toolName" in event && event.toolName ? event.toolName : "unknown_tool";
}

function getTextDelta(event: ChatStreamEventContract): string {
  if ("delta" in event && typeof event.delta === "string") {
    return event.delta;
  }
  if ("content" in event && typeof event.content === "string") {
    return event.content;
  }
  return "";
}

function getToolArgsDelta(event: ChatStreamEventContract): string {
  return "argsDelta" in event && typeof event.argsDelta === "string"
    ? event.argsDelta
    : "";
}

function handleToolStart(context: StreamTurnContext, event: ChatStreamEventContract): void {
  const { buffers, setTimeline, state } = context;
  const toolCallId = getToolCallId(event);
  if (!toolCallId) return;

  const toolName = getToolName(event);
  const args = normalizeToolArgs("args" in event ? event.args : undefined);

  buffers.toolArgsDeltaBufferRef.current.delete(toolCallId);

  const isAutoResume =
    isFrontendToolName(toolName) && shouldAutoResumeFrontendTool(toolName);

  if (!isAutoResume) {
    state.toolLoadingStartedAt.set(toolCallId, performance.now());
  }

  setTimeline((prev) => {
    // Exact match by toolCallId (may already exist from TOOL_CALL_ARGS_DELTA).
    const exactIdx = prev.findIndex(
      (item) => item.kind === "tool" && item.toolCallId === toolCallId,
    );
    if (exactIdx >= 0) {
      const current = prev[exactIdx] as ChatToolCallItem;
      const upgraded = [...prev];
      upgraded[exactIdx] = {
        ...current,
        toolName,
        args:
          Object.keys(args).length > 0
            ? { ...current.args, ...args }
            : current.args,
        pending: false,
      };
      return upgraded;
    }

    // No existing entry — create a new one.
    return upsertToolCall(prev, {
      kind: "tool",
      id: `tool-${toolCallId}`,
      toolCallId,
      toolName,
      args,
      status: "loading",
    });
  });

  if (!isAutoResume) {
    return;
  }

  const toolResult = buildAutoToolResult(toolName, args);
  setTimeline((prev) =>
    upsertToolCall(prev, {
      kind: "tool",
      id: `tool-${toolCallId}`,
      toolCallId,
      toolName,
      args,
      result: toolResult,
      status: "complete",
    }),
  );

  if (!state.autoResumeToolIds.has(toolCallId)) {
    state.autoResumeToolIds.add(toolCallId);
    state.pendingAutoResume.push({
      toolCallId,
      toolResult,
      reasoningMode: state.reasoningMode,
    });
  }
}

function handleToolEnd(context: StreamTurnContext, event: ChatStreamEventContract): void {
  const { controller, setTimeline, state } = context;
  const toolCallId = getToolCallId(event);
  if (!toolCallId) return;

  const toolName = getToolName(event);
  const args = normalizeToolArgs("args" in event ? event.args : undefined);
  const normalizedResult = normalizeToolResult("result" in event ? event.result : undefined);
  const status = resolveToolStatus(normalizedResult);

  const loadingStartedAt = state.toolLoadingStartedAt.get(toolCallId);
  state.toolLoadingStartedAt.delete(toolCallId);

  const applyToolEnd = () => {
    if (controller.signal.aborted) return;
    setTimeline((prev) =>
      upsertToolCall(prev, {
        kind: "tool",
        id: `tool-${toolCallId}`,
        toolCallId,
        toolName,
        args,
        result: normalizedResult,
        status: status === "loading" ? "complete" : status,
      }),
    );
  };

  if (!loadingStartedAt) {
    setTimeline((prev) =>
      upsertToolCall(prev, {
        kind: "tool",
        id: `tool-${toolCallId}`,
        toolCallId,
        toolName,
        args,
        status: "loading",
      }),
    );
    window.setTimeout(applyToolEnd, MIN_TOOL_LOADING_MS);
    return;
  }

  const elapsed = performance.now() - loadingStartedAt;
  const waitMs = Math.max(0, MIN_TOOL_LOADING_MS - elapsed);
  if (waitMs > 0) {
    window.setTimeout(applyToolEnd, waitMs);
    return;
  }

  applyToolEnd();
}

function handleStreamEvent(context: StreamTurnContext, event: ChatStreamEventContract): void {
  const { buffers, setTimeline, state } = context;
  const eventMessageId = getEventMessageId(event);

  if (eventMessageId) {
    state.activeAssistantId = eventMessageId;
  }

  const rawType = event.type;

  if (rawType === "TEXT_MESSAGE_START") {
    buffers.flushBufferedTextDeltas();
    const role = "role" in event ? String(event.role ?? "") : "";
    if (role && role !== "assistant") {
      return;
    }
    const content =
      "content" in event && typeof event.content === "string"
        ? event.content
        : "";
    setTimeline((prev) =>
      upsertTextMessage(prev, {
        kind: "text",
        id: state.activeAssistantId,
        role: "assistant",
        content,
        status: "streaming",
      }),
    );
    return;
  }

  if (rawType === "TEXT_MESSAGE_CONTENT") {
    const delta = getTextDelta(event);
    if (!delta) {
      return;
    }

    const buffered =
      buffers.textDeltaBufferRef.current.get(state.activeAssistantId) ?? "";
    buffers.textDeltaBufferRef.current.set(
      state.activeAssistantId,
      `${buffered}${delta}`,
    );
    buffers.scheduleBufferedTextDeltaFlush();
    return;
  }

  if (rawType === "TEXT_MESSAGE_END") {
    buffers.flushBufferedTextDeltas();
    buffers.flushBufferedReasoningDeltas();
    setTimeline((prev) => {
      const existing = prev.find(
        (item) => item.kind === "text" && item.id === state.activeAssistantId,
      );
      if (!existing || existing.kind !== "text") {
        return prev;
      }

      return upsertTextMessage(prev, { ...existing, status: "complete" });
    });
    return;
  }

  if (rawType === "REASONING_START") {
    setTimeline((prev) => {
      const existing = prev.find(
        (item) => item.kind === "text" && item.id === state.activeAssistantId,
      );
      if (existing) {
        return prev;
      }

      return upsertTextMessage(prev, {
        kind: "text",
        id: state.activeAssistantId,
        role: "assistant",
        content: "",
        status: "streaming",
        reasoningContent: "",
      });
    });
    return;
  }

  if (rawType === "REASONING_CONTENT") {
    const delta = getTextDelta(event);
    if (!delta) {
      return;
    }

    const buffered =
      buffers.reasoningDeltaBufferRef.current.get(state.activeAssistantId) ?? "";
    buffers.reasoningDeltaBufferRef.current.set(
      state.activeAssistantId,
      `${buffered}${delta}`,
    );
    buffers.scheduleBufferedReasoningDeltaFlush();
    return;
  }

  if (rawType === "REASONING_END") {
    buffers.flushBufferedReasoningDeltas();
    return;
  }

  if (rawType === "TOOL_CALL_START") {
    buffers.flushBufferedTextDeltas();
    buffers.flushBufferedToolArgsDeltas();
    handleToolStart(context, event);
    return;
  }

  if (rawType === "TOOL_CALL_END") {
    buffers.flushBufferedTextDeltas();
    handleToolEnd(context, event);
    return;
  }

  if (rawType === "TOOL_CALL_ARGS_DELTA") {
    const toolCallId = getToolCallId(event);
    const argsDelta = getToolArgsDelta(event);
    if (!toolCallId || !argsDelta) {
      return;
    }

    const existing = buffers.toolArgsDeltaBufferRef.current.get(toolCallId);
    const raw = existing ? existing.raw + argsDelta : argsDelta;
    buffers.toolArgsDeltaBufferRef.current.set(toolCallId, {
      raw,
      toolName: getToolName(event),
    });
    buffers.scheduleBufferedToolArgsDeltaFlush();
    return;
  }

  if (rawType === "RUN_ERROR") {
    buffers.flushBufferedTextDeltas();
    state.runHasError = true;
    const errorText =
      "error" in event && typeof event.error === "string"
        ? event.error
        : "message" in event && typeof event.message === "string"
          ? event.message
          : "运行失败";
    upsertAssistantError(setTimeline, state.activeAssistantId, errorText);
    return;
  }

  if (rawType === "RUN_FINISHED") {
    if (
      "totalTokens" in event &&
      typeof event.totalTokens === "number" &&
      "contextWindow" in event &&
      typeof event.contextWindow === "number" &&
      context.onTokenUsage
    ) {
      context.onTokenUsage({
        inputTokens: typeof event.inputTokens === "number" ? event.inputTokens : 0,
        outputTokens: typeof event.outputTokens === "number" ? event.outputTokens : 0,
        totalTokens: event.totalTokens,
        contextWindow: event.contextWindow,
      });
    }
  }
}

export async function runChatStreamTurn({
  threadIdForRun,
  payload,
  controller,
  setTimeline,
  buffers,
  onTokenUsage,
}: RunChatStreamTurnOptions): Promise<RunChatStreamTurnResult> {
  const state: StreamTurnState = {
    activeAssistantId: `assistant-${crypto.randomUUID()}`,
    autoResumeToolIds: new Set<string>(),
    pendingAutoResume: [],
    runHasError: false,
    reasoningMode:
      typeof payload.reasoningMode === "boolean" ? payload.reasoningMode : false,
    toolLoadingStartedAt: new Map<string, number>(),
  };

  const context: StreamTurnContext = {
    controller,
    setTimeline,
    buffers,
    state,
    onTokenUsage,
  };

  try {
    await readChatStreamEvents({
      threadIdForRun,
      payload,
      reasoningMode: state.reasoningMode,
      knowledgeSourceIds: "knowledgeSourceIds" in payload ? payload.knowledgeSourceIds : undefined,
      signal: controller.signal,
      onEvent: (event) => {
        handleStreamEvent(context, event);
      },
    });

    buffers.flushBufferedTextDeltas();
    buffers.flushBufferedReasoningDeltas();
    buffers.flushBufferedToolArgsDeltas();
    setTimeline((prev) => finalizeTimelineAfterRun(prev, "工具执行中断"));

    if (state.runHasError || controller.signal.aborted) {
      return {
        aborted: controller.signal.aborted,
        runHasError: state.runHasError,
        pendingAutoResume: [],
      };
    }

    return {
      aborted: false,
      runHasError: false,
      pendingAutoResume: state.pendingAutoResume,
    };
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        aborted: true,
        runHasError: state.runHasError,
        pendingAutoResume: [],
      };
    }

    buffers.flushBufferedTextDeltas();
    buffers.flushBufferedReasoningDeltas();
    buffers.flushBufferedToolArgsDeltas();

    const messageText = error instanceof Error ? error.message : "请求失败";
    appendRequestError(setTimeline, state.activeAssistantId, messageText);

    return {
      aborted: false,
      runHasError: true,
      pendingAutoResume: [],
    };
  } finally {
    buffers.flushBufferedTextDeltas();
    buffers.flushBufferedReasoningDeltas();
    buffers.flushBufferedToolArgsDeltas();
    buffers.clearBufferedToolArgsDeltas();
  }
}
