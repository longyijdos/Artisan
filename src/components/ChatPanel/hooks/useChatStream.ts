"use client";

import { useCallback, useRef, useState } from "react";
import type { ChatAttachment, ChatRunPayload, ChatTimelineItem } from "../types";
import { appendTimelineItem, finalizeTimelineAfterRun } from "../utils";
import { runChatStreamTurn } from "./chatStreamTurn";
import type { TokenUsage } from "./chatStreamTurn";
import { useChatStreamBuffers } from "./useChatStreamBuffers";

export interface UseChatStreamReturn {
  runStream: (threadIdForRun: string, initialPayload: ChatRunPayload) => Promise<void>;
  stop: () => Promise<void>;
  sendMessageToThread: (
    threadIdForRun: string,
    message: string,
    reasoningMode?: boolean,
    attachments?: ChatAttachment[],
    knowledgeSourceIds?: number[],
  ) => Promise<void>;
  isRunning: boolean;
  preRunToolIdsRef: React.MutableRefObject<Set<string>>;
  tokenUsage: TokenUsage;
}

export function useChatStream(
  setTimeline: React.Dispatch<React.SetStateAction<ChatTimelineItem[]>>,
  abortControllerRef: React.MutableRefObject<AbortController | null>,
  activeThreadId: string | null,
  isHistoryLoading: boolean,
  isSessionSwitching: boolean,
  scrollToBottom: (options?: { animation?: "smooth" | "instant" }) => void,
  onRunningChange?: (isRunning: boolean) => void,
): UseChatStreamReturn {
  const [isRunning, _setIsRunning] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    contextWindow: 128_000,
  });
  const preRunToolIdsRef = useRef<Set<string>>(new Set());
  const buffers = useChatStreamBuffers(setTimeline);

  // ── setIsRunning helper ────────────────────────────────────
  const setIsRunning = useCallback((value: boolean) => {
    _setIsRunning(value);
    onRunningChange?.(value);
  }, [onRunningChange]);

  // ── stop ───────────────────────────────────────────────────
  const stop = useCallback(async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsRunning(false);

    setTimeline((prev) => finalizeTimelineAfterRun(prev, "已停止"));

    window.setTimeout(() => {
      setTimeline((prev) => prev.filter((item) => !(item.kind === "tool" && item.status === "exiting")));
    }, 300);

    if (activeThreadId) {
      await fetch("/api/chat/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: activeThreadId }),
      }).catch(() => undefined);
    }
  }, [abortControllerRef, activeThreadId, setIsRunning, setTimeline]);

  // ── runStream ──────────────────────────────────────────────
  const runStream = useCallback(
    async (threadIdForRun: string, initialPayload: ChatRunPayload) => {
      if (!threadIdForRun || isHistoryLoading || isSessionSwitching) return;

      const runQueue: ChatRunPayload[] = [initialPayload];

      setTimeline((prev) => {
        preRunToolIdsRef.current = new Set(
          prev.filter((i) => i.kind === "tool").map((i) => i.id),
        );
        return prev;
      });

      setIsRunning(true);

      try {
        while (runQueue.length > 0) {
          const currentPayload = runQueue.shift();
          if (!currentPayload) break;

          const controller = new AbortController();
          abortControllerRef.current = controller;
          try {
            const result = await runChatStreamTurn({
              threadIdForRun,
              payload: currentPayload,
              controller,
              setTimeline,
              buffers,
              onTokenUsage: setTokenUsage,
            });

            if (result.runHasError || result.aborted) {
              return;
            }

            result.pendingAutoResume.forEach((nextPayload) => {
              runQueue.push(nextPayload);
            });
          } finally {
            if (abortControllerRef.current === controller) {
              abortControllerRef.current = null;
            }
          }
        }
      } finally {
        setIsRunning(false);
      }
    },
    [
      abortControllerRef,
      buffers,
      isHistoryLoading,
      isSessionSwitching,
      setIsRunning,
      setTimeline,
    ],
  );

  // ── sendMessageToThread ────────────────────────────────────
  const sendMessageToThread = useCallback(
    async (
      threadIdForRun: string,
      message: string,
      reasoningMode = false,
      attachments: ChatAttachment[] = [],
      knowledgeSourceIds: number[] = [],
    ) => {
      const userMessageId = `user-${crypto.randomUUID()}`;
      setTimeline((prev) =>
        appendTimelineItem(prev, {
          kind: "text",
          id: userMessageId,
          role: "user",
          content: message,
          status: "complete",
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      );

      scrollToBottom({ animation: "smooth" });

      await runStream(threadIdForRun, {
        message,
        reasoningMode,
        knowledgeSourceIds: knowledgeSourceIds.length > 0 ? knowledgeSourceIds : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
    },
    [runStream, scrollToBottom, setTimeline],
  );

  return {
    runStream,
    stop,
    sendMessageToThread,
    isRunning,
    preRunToolIdsRef,
    tokenUsage,
  };
}
