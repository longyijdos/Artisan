import type {
  ChatAttachment,
  ChatTextMessage,
  ChatTimelineItem,
  ChatToolCallItem,
  ToolStatus,
} from "./types";
import { FRONTEND_TOOL_NAMES } from "./types";
import type {
  ChatHistoryMessageContract,
  ChatHistoryToolCallFunctionContract,
  ChatToolArgsContract,
  ChatToolResultContract,
  JsonValue,
} from "@/lib/chat/contracts";
import { isJsonObject } from "@/lib/chat/contracts";

// ── SSE parsing (via eventsource-parser) ─────────────────────

export { parseSseBuffer } from "./sse";

// ── Type guards & helpers ────────────────────────────────────

export function isFrontendToolName(toolName: string): boolean {
  return FRONTEND_TOOL_NAMES.has(toolName);
}

export function shouldAutoResumeFrontendTool(toolName: string): boolean {
  return new Set(["update_plan"]).has(toolName);
}

export function buildAutoToolResult(
  toolName: string,
  args: ChatToolArgsContract,
): ChatToolResultContract {
  if (toolName === "update_plan") {
    const explanation =
      typeof args.explanation === "string" ? args.explanation : undefined;
    return {
      status: "success",
      ...(explanation ? { explanation } : {}),
      plan: Array.isArray(args.plan) ? args.plan : [],
    };
  }
  return { status: "success" };
}

// ── Timeline manipulation ────────────────────────────────────

export function finalizeTimelineAfterRun(
  timeline: ChatTimelineItem[],
  loadingToolErrorMessage: string,
): ChatTimelineItem[] {
  return timeline.map((item) => {
    if (item.kind === "text") {
      return item.status === "streaming" ? { ...item, status: "complete" as const } : item;
    }
    if (item.status !== "loading") {
      return item;
    }
    if (isFrontendToolName(item.toolName)) {
      return item;
    }
    if (item.pending) {
      return { ...item, status: "exiting" as const };
    }
    return {
      ...item,
      status: "error" as const,
      result: item.result ?? { status: "error", message: loadingToolErrorMessage },
    };
  });
}

export function normalizeAssistantDisplayContent(content: string, nextIsTool: boolean): string {
  if (!nextIsTool) {
    return content;
  }
  return content.replace(/\n+$/g, "");
}

export function appendTimelineItem(
  timeline: ChatTimelineItem[],
  item: ChatTimelineItem,
): ChatTimelineItem[] {
  return [...timeline, item];
}

export function upsertTextMessage(
  timeline: ChatTimelineItem[],
  next: ChatTextMessage,
): ChatTimelineItem[] {
  const index = timeline.findIndex((item) => item.kind === "text" && item.id === next.id);
  if (index < 0) {
    return [...timeline, next];
  }
  const cloned = [...timeline];
  const existing = cloned[index];
  // Merge: preserve fields from existing that are not explicitly provided in next
  cloned[index] = existing.kind === "text"
    ? { ...existing, ...next, reasoningContent: next.reasoningContent ?? existing.reasoningContent }
    : next;
  return cloned;
}

export function upsertToolCall(
  timeline: ChatTimelineItem[],
  next: ChatToolCallItem,
): ChatTimelineItem[] {
  const index = timeline.findIndex(
    (item) => item.kind === "tool" && item.toolCallId === next.toolCallId,
  );
  if (index < 0) {
    return [...timeline, next];
  }
  const cloned = [...timeline];
  const current = cloned[index];
  if (current.kind === "tool") {
    cloned[index] = {
      ...current,
      ...next,
      id: current.id,
      args: { ...current.args, ...(Object.keys(next.args).length > 0 ? next.args : {}) },
      toolName: next.toolName || current.toolName,
    };
  }
  return cloned;
}

// ── Tool arg / result normalization ──────────────────────────

export function normalizeToolArgs(rawArgs: JsonValue | undefined): ChatToolArgsContract {
  if (isJsonObject(rawArgs)) {
    return rawArgs;
  }
  if (typeof rawArgs === "string") {
    const trimmed = rawArgs.trim();
    if (!trimmed) {
      return {};
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (isJsonObject(parsed)) {
        return parsed;
      }
      return { input: parsed };
    } catch {
      return { input: rawArgs };
    }
  }
  return {};
}

function normalizeHistoryAttachments(
  raw: ChatHistoryMessageContract["attachments"],
): ChatAttachment[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const normalized: ChatAttachment[] = [];
  for (const item of raw) {
    const path = typeof item.path === "string" ? item.path : "";
    if (!path.trim()) continue;
    const name =
      typeof item.name === "string" && item.name.trim()
        ? item.name
        : path.split("/").filter(Boolean).pop() ?? "file";
    const id =
      typeof item.id === "string" && item.id.trim()
        ? item.id
        : `att-${crypto.randomUUID()}`;
    normalized.push({
      id,
      name,
      path,
      size: typeof item.size === "number" && Number.isFinite(item.size) ? Math.max(0, Math.floor(item.size)) : 0,
      mimeType: typeof item.mimeType === "string" && item.mimeType.trim() ? item.mimeType : undefined,
    });
  }
  return normalized;
}

export function normalizeToolResult(
  rawResult: JsonValue | undefined,
): ChatToolResultContract | undefined {
  if (typeof rawResult === "string") {
    const trimmed = rawResult.trim();
    if (!trimmed) {
      return { output: "" };
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return { output: rawResult };
    }
  }

  if (Array.isArray(rawResult)) {
    const textParts = rawResult
      .map((item) => {
        if (typeof item === "string") return item;
        if (isJsonObject(item) && item.type === "text" && typeof item.text === "string") {
          return item.text;
        }
        return "";
      })
      .filter(Boolean);
    if (textParts.length > 0) {
      const merged = textParts.join("");
      try {
        return JSON.parse(merged);
      } catch {
        return { output: merged };
      }
    }
  }

  return rawResult;
}

export function resolveToolStatus(result: ChatToolResultContract | undefined): ToolStatus {
  if (result === undefined) {
    return "loading";
  }
  if (isJsonObject(result)) {
    const status = result.status;
    if (typeof status === "string") {
      if (status === "error" || status === "failed") return "error";
      if (status === "loading" || status === "running") return "loading";
      if (status === "success") return "complete";
    }
    const exitCode = result.exit_code;
    if (typeof exitCode === "number") {
      return exitCode === 0 ? "complete" : "error";
    }
  }
  return "complete";
}

// ── History normalization ────────────────────────────────────

export function normalizeHistoryTimeline(
  input: ChatHistoryMessageContract[] | undefined,
): ChatTimelineItem[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const timeline: ChatTimelineItem[] = [];
  const toolIndexById = new Map<string, number>();

  for (const item of input) {
    const role = item.role === "user" || item.role === "assistant" || item.role === "tool" ? item.role : null;
    if (!role) {
      continue;
    }

    if (role === "user" || role === "assistant") {
      const id =
        typeof item.id === "string" && item.id.trim()
          ? item.id
          : `${role}-${crypto.randomUUID()}`;
      const content = typeof item.content === "string" ? item.content : String(item.content ?? "");
      const reasoningContent =
        typeof item.reasoning_content === "string"
          ? item.reasoning_content
          : undefined;
      const attachments = normalizeHistoryAttachments(item.attachments);

      if (!(role === "assistant" && content.trim().length === 0 && !reasoningContent)) {
        const msg: ChatTextMessage = {
          kind: "text",
          id,
          role,
          content,
          status: "complete",
        };
        if (reasoningContent) {
          msg.reasoningContent = reasoningContent;
        }
        if (attachments.length > 0) {
          msg.attachments = attachments;
        }
        timeline.push(msg);
      }

      if (role !== "assistant") {
        continue;
      }

      const toolCalls = Array.isArray(item.tool_calls) ? item.tool_calls : [];
      for (const toolCall of toolCalls) {
        const toolCallId =
          typeof toolCall.id === "string" && toolCall.id.trim()
            ? toolCall.id
            : `tool-${crypto.randomUUID()}`;
        const fnPart: ChatHistoryToolCallFunctionContract | undefined = toolCall.function;
        const toolName =
          (typeof fnPart?.name === "string" && fnPart.name.trim()) ||
          (typeof toolCall.name === "string" && toolCall.name.trim()) ||
          "unknown_tool";
        const args = normalizeToolArgs(fnPart?.arguments ?? toolCall.args);

        timeline.push({
          kind: "tool",
          id: `tool-${toolCallId}`,
          toolCallId,
          toolName,
          args,
          status: "loading",
        });
        toolIndexById.set(toolCallId, timeline.length - 1);
      }
      continue;
    }

    const toolCallId =
      typeof item.tool_call_id === "string" && item.tool_call_id.trim()
        ? item.tool_call_id
        : `tool-${crypto.randomUUID()}`;
    const normalizedResult = normalizeToolResult(item.content);
    const status = resolveToolStatus(normalizedResult);

    if (toolIndexById.has(toolCallId)) {
      const index = toolIndexById.get(toolCallId);
      if (index !== undefined) {
        const existing = timeline[index];
        if (existing && existing.kind === "tool") {
          timeline[index] = {
            ...existing,
            result: normalizedResult,
            status: status === "loading" ? "complete" : status,
          };
        }
      }
      continue;
    }

    timeline.push({
      kind: "tool",
      id: `tool-${toolCallId}`,
      toolCallId,
      toolName: "unknown_tool",
      args: {},
      result: normalizedResult,
      status: status === "loading" ? "complete" : status,
    });
  }

  return timeline.map((item) => {
    if (item.kind !== "tool" || item.status !== "loading" || isFrontendToolName(item.toolName)) {
      return item;
    }
    return {
      ...item,
      status: "error" as const,
      result: item.result ?? { status: "error", message: "工具调用未完成" },
    };
  });
}
