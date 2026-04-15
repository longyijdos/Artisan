"use client";

import {
  ActivateSkillCall,
  EditFileCall,
  GlobCall,
  GrepCall,
  LsCall,
  ReadFileCall,
  ShellCall,
  ToolCallCard,
  WebFetchCall,
  WebSearchCall,
  WriteFileCall,
} from "@/components/ToolRenderers";
import type {
  ChatToolArgsContract,
  ChatToolResultContract,
  JsonObject,
} from "@/lib/chat/contracts";
import { isJsonObject } from "@/lib/chat/contracts";

type ToolCardStatus = "success" | "error" | "loading";

interface BackendToolCallProps {
  toolName: string;
  args: ChatToolArgsContract;
  result?: ChatToolResultContract;
  status?: "loading" | "complete" | "error";
  animate?: boolean;
}

const GenericToolIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.75 3a1.5 1.5 0 00-1.5 1.5v1.379a6.001 6.001 0 00-2.245 1.297l-.975-.563a1.5 1.5 0 10-1.5 2.598l.971.561a6.022 6.022 0 000 2.596l-.97.56a1.5 1.5 0 101.498 2.6l.974-.562A6.001 6.001 0 008.25 18.12V19.5a1.5 1.5 0 003 0v-1.38a6.001 6.001 0 002.245-1.297l.975.563a1.5 1.5 0 101.5-2.598l-.971-.561a6.022 6.022 0 000-2.596l.97-.56a1.5 1.5 0 10-1.498-2.6l-.974.562A6.001 6.001 0 0011.25 5.88V4.5A1.5 1.5 0 009.75 3zM10 15a3 3 0 100-6 3 3 0 000 6z"
    />
  </svg>
);

function normalizeResult(
  value: ChatToolResultContract | undefined,
): ChatToolResultContract | undefined {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { output: "" };
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return { output: value };
  }
}

function getCardStatus(
  streamStatus: BackendToolCallProps["status"],
  normalizedResult: ChatToolResultContract | undefined,
): ToolCardStatus {
  if (streamStatus === "loading") {
    return "loading";
  }
  if (streamStatus === "error") {
    return "error";
  }

  if (!isJsonObject(normalizedResult)) {
    return streamStatus === "complete" ? "success" : "loading";
  }

  const status = normalizedResult.status;
  if (typeof status === "string") {
    if (status === "error" || status === "failed") return "error";
    if (status === "success") return "success";
    if (status === "loading" || status === "running") return "loading";
  }

  if (typeof normalizedResult.exit_code === "number") {
    return normalizedResult.exit_code === 0 ? "success" : "error";
  }

  return streamStatus === "complete" ? "success" : "loading";
}

function toJsonObject(
  value: ChatToolResultContract | undefined,
): JsonObject | undefined {
  if (isJsonObject(value)) {
    return value;
  }
  return undefined;
}

export function BackendToolCall({
  toolName,
  args,
  result,
  status,
  animate,
}: BackendToolCallProps) {
  const normalizedArgs = args;
  const normalizedResult = normalizeResult(result);
  const normalizedResultObject = toJsonObject(normalizedResult);

  switch (toolName) {
    case "write_file":
      return (
        <WriteFileCall
          args={normalizedArgs as { file_path?: string; content?: string }}
          result={normalizedResultObject}
          animate={animate}
        />
      );
    case "read_file":
      return (
        <ReadFileCall
          args={normalizedArgs as { file_path: string; offset?: number; limit?: number }}
          result={normalizedResultObject}
          animate={animate}
        />
      );
    case "ls":
      return (
        <LsCall
          args={normalizedArgs as { path?: string }}
          result={normalizedResultObject}
          animate={animate}
        />
      );
    case "edit_file":
      return (
        <EditFileCall
          args={normalizedArgs as { file_path?: string; old_string?: string; new_string?: string; replace_all?: boolean }}
          result={normalizedResultObject}
          animate={animate}
        />
      );
    case "glob":
      return (
        <GlobCall
          args={normalizedArgs as { pattern?: string; path?: string }}
          result={normalizedResultObject}
          animate={animate}
        />
      );
    case "grep":
      return (
        <GrepCall
          args={normalizedArgs as { pattern?: string; path?: string; glob?: string; output_mode?: "files_with_matches" | "content" | "count" }}
          result={normalizedResultObject}
          animate={animate}
        />
      );
    case "execute_shell": {
      const shellResult = normalizedResultObject
        ? {
            ...normalizedResultObject,
            exit_code:
              typeof normalizedResultObject.exit_code === "number"
                ? normalizedResultObject.exit_code
                : normalizedResultObject.status === "error"
                  ? -1
                  : undefined,
          }
        : undefined;
      return (
        <ShellCall
          args={normalizedArgs as { command: string }}
          result={shellResult}
          animate={animate}
        />
      );
    }
    case "web_search":
      return (
        <WebSearchCall
          args={normalizedArgs as { query: string; summarize?: boolean; max_results?: number; topic?: string }}
          result={normalizedResultObject}
          animate={animate}
        />
      );
    case "web_fetch":
      return (
        <WebFetchCall
          args={normalizedArgs as { url?: string; max_chars?: number }}
          result={normalizedResultObject}
          animate={animate}
        />
      );
    case "activate_skill":
      return (
        <ActivateSkillCall
          args={normalizedArgs as { skill_name: string }}
          result={normalizedResultObject}
          animate={animate}
        />
      );
    default: {
      const cardStatus = getCardStatus(status, normalizedResult);
      return (
        <ToolCallCard
          title={`工具调用: ${toolName || "unknown_tool"}`}
          icon={GenericToolIcon}
          status={cardStatus}
          animate={animate}
        >
          <div className="space-y-2">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Args</p>
              <pre className="mt-1 overflow-x-auto rounded-md border border-indigo-100 bg-white/75 p-2 text-xs text-slate-700">
                {JSON.stringify(normalizedArgs, null, 2)}
              </pre>
            </div>
            {normalizedResult !== undefined && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Result</p>
                <pre className="mt-1 overflow-x-auto rounded-md border border-indigo-100 bg-white/75 p-2 text-xs text-slate-700">
                  {JSON.stringify(normalizedResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </ToolCallCard>
      );
    }
  }
}
