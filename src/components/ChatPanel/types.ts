import type {
  ChatAttachmentContract,
  ChatHistoryMessageContract,
  ChatHistoryToolCallContract,
  ChatHistoryToolCallFunctionContract,
  ChatToolArgsContract,
  ChatToolResultContract,
} from "@/lib/chat/contracts";

export type MessageRole = "user" | "assistant";
export type TextStatus = "streaming" | "complete" | "error";
export type ToolStatus = "loading" | "complete" | "error" | "exiting";

export type ChatAttachment = ChatAttachmentContract;

export type AttachmentUploadStatus = "uploading" | "ready" | "error";

export interface ComposerAttachment extends ChatAttachment {
  uploadStatus: AttachmentUploadStatus;
  progress: number;
}

export interface ChatTextMessage {
  kind: "text";
  id: string;
  role: MessageRole;
  content: string;
  status: TextStatus;
  /** Reasoning/thinking content from reasoning models (e.g. deepseek-reasoner) */
  reasoningContent?: string;
  attachments?: ChatAttachment[];
}

export interface ChatToolCallItem {
  kind: "tool";
  id: string;
  toolCallId: string;
  toolName: string;
  args: ChatToolArgsContract;
  result?: ChatToolResultContract;
  status: ToolStatus;
  /** True when created by TOOL_CALL_ARGS_DELTA before TOOL_CALL_START confirms execution. */
  pending?: boolean;
}

export type ChatTimelineItem = ChatTextMessage | ChatToolCallItem;

export type ChatRunPayload =
  | { message: string; reasoningMode?: boolean; knowledgeSourceIds?: number[]; attachments?: ChatAttachment[] }
  | { toolCallId: string; toolResult: ChatToolResultContract; reasoningMode?: boolean; knowledgeSourceIds?: number[]; attachments?: ChatAttachment[] };

export type HistoryToolCallFunction = ChatHistoryToolCallFunctionContract;
export type HistoryToolCall = ChatHistoryToolCallContract;
export type HistoryMessage = ChatHistoryMessageContract;

export interface ChatPanelProps {
  threadId: string | null;
  onBeforeRun?: (message: string, threadId?: string) => void;
  onRequestCreateThread?: () => Promise<string | null>;
  onRunningChange?: (isRunning: boolean) => void;
}

export const FRONTEND_TOOL_NAMES = new Set(["ask_user", "update_plan"]);
export const AUTO_RESUME_FRONTEND_TOOL_NAMES = new Set(["update_plan"]);
export const MIN_TOOL_LOADING_MS = 240;
export const SESSION_SWITCH_LOADING_DELAY_MS = 220;
