"use client";

import { AskUserCall, UpdatePlanCall } from "@/components/ToolRenderers";
import type {
  ChatToolArgsContract,
  ChatToolResultContract,
  JsonObject,
  JsonValue,
} from "@/lib/chat/contracts";
import { isJsonObject } from "@/lib/chat/contracts";

interface FrontendToolCallProps {
  toolCallId: string;
  toolName: string;
  args: ChatToolArgsContract;
  result?: ChatToolResultContract;
  status?: "loading" | "complete" | "error";
  pending?: boolean;
  animate?: boolean;
  onAskUserSubmit: (toolCallId: string, data: Record<string, string>) => void;
}

function toRecordOrUndefined(
  value: ChatToolResultContract | undefined,
): JsonObject | undefined {
  if (value === undefined || value === null) return undefined;
  if (isJsonObject(value)) return Object.keys(value).length > 0 ? value : undefined;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isJsonObject(parsed) && Object.keys(parsed).length > 0 ? parsed : undefined;
    } catch {
      return { value };
    }
  }
  return undefined;
}

function normalizePlan(raw: JsonValue | undefined): Array<{ step: string; status: string }> {
  if (!Array.isArray(raw)) return [];
  const plan: Array<{ step: string; status: string }> = [];
  for (const entry of raw) {
    if (!isJsonObject(entry)) continue;
    const step = typeof entry.step === "string" ? entry.step : "";
    if (!step) continue;
    const status =
      entry.status === "completed" || entry.status === "in_progress" || entry.status === "pending"
        ? entry.status
        : "pending";
    plan.push({ step, status });
  }
  return plan;
}

export function FrontendToolCall({
  toolCallId,
  toolName,
  args,
  result,
  status,
  pending,
  animate,
  onAskUserSubmit,
}: FrontendToolCallProps) {
  const normalizedResult = toRecordOrUndefined(result);

  switch (toolName) {
    case "ask_user":
      return (
        <AskUserCall
          args={args as { title?: string; fields?: JsonValue }}
          result={normalizedResult as { status?: string } | undefined}
          pending={pending}
          animate={animate}
          onSubmit={(data) => onAskUserSubmit(toolCallId, data)}
        />
      );

    case "update_plan": {
      const argsView = {
        explanation: typeof args.explanation === "string" ? args.explanation : undefined,
        plan: normalizePlan(args.plan),
      };
      const resultView = normalizedResult
        ? {
            status:
              normalizedResult.status === "error" ? "error"
                : normalizedResult.status === "success" ? "success"
                : status === "complete" ? "success"
                : "loading",
            explanation:
              typeof normalizedResult.explanation === "string"
                ? normalizedResult.explanation
                : argsView.explanation,
            plan: normalizePlan(normalizedResult.plan ?? args.plan),
          }
        : undefined;
      return (
        <UpdatePlanCall
          args={argsView}
          result={resultView}
          pending={pending}
          animate={animate}
        />
      );
    }

    default:
      return null;
  }
}
