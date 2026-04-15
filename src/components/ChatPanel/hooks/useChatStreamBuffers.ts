"use client";

import { useCallback, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { ChatToolArgsContract } from "@/lib/chat/contracts";
import { isJsonObject } from "@/lib/chat/contracts";
import type { ChatTimelineItem } from "../types";
import { upsertTextMessage, upsertToolCall } from "../utils";

interface BufferedToolArgsEntry {
  raw: string;
  toolName: string;
}

export interface UseChatStreamBuffersReturn {
  textDeltaBufferRef: MutableRefObject<Map<string, string>>;
  reasoningDeltaBufferRef: MutableRefObject<Map<string, string>>;
  toolArgsDeltaBufferRef: MutableRefObject<Map<string, BufferedToolArgsEntry>>;
  flushBufferedTextDeltas: () => void;
  scheduleBufferedTextDeltaFlush: () => void;
  flushBufferedReasoningDeltas: () => void;
  scheduleBufferedReasoningDeltaFlush: () => void;
  flushBufferedToolArgsDeltas: () => void;
  scheduleBufferedToolArgsDeltaFlush: () => void;
  clearBufferedToolArgsDeltas: () => void;
}

function tryParseBufferedToolArgs(raw: string): ChatToolArgsContract | null {
  try {
    const parsed = JSON.parse(raw);
    if (isJsonObject(parsed)) {
      return parsed;
    }
  } catch {
    for (const suffix of ["}", "\"}", "\"}"]) {
      try {
        const patched = JSON.parse(raw + suffix);
        if (isJsonObject(patched)) {
          return patched;
        }
      } catch {
        // Continue trying the remaining suffixes.
      }
    }
  }

  return null;
}

export function useChatStreamBuffers(
  setTimeline: Dispatch<SetStateAction<ChatTimelineItem[]>>,
): UseChatStreamBuffersReturn {
  const textDeltaBufferRef = useRef<Map<string, string>>(new Map());
  const textDeltaFlushRafRef = useRef<number | null>(null);
  const reasoningDeltaBufferRef = useRef<Map<string, string>>(new Map());
  const reasoningDeltaFlushRafRef = useRef<number | null>(null);
  const toolArgsDeltaBufferRef = useRef<Map<string, BufferedToolArgsEntry>>(new Map());
  const toolArgsDeltaFlushRafRef = useRef<number | null>(null);

  const flushBufferedTextDeltas = useCallback(() => {
    const pending = textDeltaBufferRef.current;
    if (pending.size === 0) return;

    const entries = Array.from(pending.entries());
    pending.clear();

    setTimeline((prev) => {
      let next = prev;
      for (const [messageId, delta] of entries) {
        if (!delta) continue;
        const existing = next.find(
          (item) => item.kind === "text" && item.id === messageId,
        );
        next = upsertTextMessage(next, {
          kind: "text",
          id: messageId,
          role: "assistant",
          content: `${existing && existing.kind === "text" ? existing.content : ""}${delta}`,
          status: "streaming",
        });
      }
      return next;
    });
  }, [setTimeline]);

  const scheduleBufferedTextDeltaFlush = useCallback(() => {
    if (textDeltaFlushRafRef.current !== null) return;
    textDeltaFlushRafRef.current = window.requestAnimationFrame(() => {
      textDeltaFlushRafRef.current = null;
      flushBufferedTextDeltas();
    });
  }, [flushBufferedTextDeltas]);

  const flushBufferedReasoningDeltas = useCallback(() => {
    const pending = reasoningDeltaBufferRef.current;
    if (pending.size === 0) return;

    const entries = Array.from(pending.entries());
    pending.clear();

    setTimeline((prev) => {
      let next = prev;
      for (const [messageId, delta] of entries) {
        if (!delta) continue;
        const existing = next.find(
          (item) => item.kind === "text" && item.id === messageId,
        );
        const prevReasoning =
          existing && existing.kind === "text" ? (existing.reasoningContent ?? "") : "";
        next = upsertTextMessage(next, {
          kind: "text",
          id: messageId,
          role: "assistant",
          content: existing && existing.kind === "text" ? existing.content : "",
          status: "streaming",
          reasoningContent: `${prevReasoning}${delta}`,
        });
      }
      return next;
    });
  }, [setTimeline]);

  const scheduleBufferedReasoningDeltaFlush = useCallback(() => {
    if (reasoningDeltaFlushRafRef.current !== null) return;
    reasoningDeltaFlushRafRef.current = window.requestAnimationFrame(() => {
      reasoningDeltaFlushRafRef.current = null;
      flushBufferedReasoningDeltas();
    });
  }, [flushBufferedReasoningDeltas]);

  const flushBufferedToolArgsDeltas = useCallback(() => {
    if (toolArgsDeltaFlushRafRef.current !== null) {
      window.cancelAnimationFrame(toolArgsDeltaFlushRafRef.current);
      toolArgsDeltaFlushRafRef.current = null;
    }

    const pending = toolArgsDeltaBufferRef.current;
    if (pending.size === 0) return;
    const entries = Array.from(pending.entries());

    setTimeline((prev) => {
      let next = prev;
      for (const [toolCallId, { raw, toolName }] of entries) {
        const parsedArgs = tryParseBufferedToolArgs(raw);
        if (!parsedArgs) {
          const existingPending = next.find(
            (item) => item.kind === "tool" && item.toolCallId === toolCallId,
          );
          if (!existingPending) {
            next = [
              ...next,
              {
                kind: "tool" as const,
                id: `tool-pending-${crypto.randomUUID()}`,
                toolCallId,
                toolName,
                args: {},
                status: "loading" as const,
                pending: true,
              },
            ];
          }
          continue;
        }

        const existing = next.find(
          (item) => item.kind === "tool" && item.toolCallId === toolCallId,
        );
        if (existing && existing.kind === "tool") {
          next = upsertToolCall(next, {
            ...existing,
            args: { ...existing.args, ...parsedArgs },
          });
        } else {
          next = [
            ...next,
            {
              kind: "tool" as const,
              id: `tool-pending-${crypto.randomUUID()}`,
              toolCallId,
              toolName,
              args: parsedArgs,
              status: "loading" as const,
              pending: true,
            },
          ];
        }
      }
      return next;
    });
  }, [setTimeline]);

  const clearBufferedToolArgsDeltas = useCallback(() => {
    if (toolArgsDeltaFlushRafRef.current !== null) {
      window.cancelAnimationFrame(toolArgsDeltaFlushRafRef.current);
      toolArgsDeltaFlushRafRef.current = null;
    }
    toolArgsDeltaBufferRef.current.clear();
  }, []);

  const scheduleBufferedToolArgsDeltaFlush = useCallback(() => {
    if (toolArgsDeltaFlushRafRef.current !== null) return;
    toolArgsDeltaFlushRafRef.current = window.requestAnimationFrame(() => {
      toolArgsDeltaFlushRafRef.current = null;
      flushBufferedToolArgsDeltas();
    });
  }, [flushBufferedToolArgsDeltas]);

  return {
    textDeltaBufferRef,
    reasoningDeltaBufferRef,
    toolArgsDeltaBufferRef,
    flushBufferedTextDeltas,
    scheduleBufferedTextDeltaFlush,
    flushBufferedReasoningDeltas,
    scheduleBufferedReasoningDeltaFlush,
    flushBufferedToolArgsDeltas,
    scheduleBufferedToolArgsDeltaFlush,
    clearBufferedToolArgsDeltas,
  };
}
