"use client";

import { useEffect } from "react";
import type { ChatAttachment } from "../types";

interface PendingSessionReplayEntry {
  message: string;
  reasoningMode: boolean;
  attachments: ChatAttachment[];
  knowledgeSourceIds?: number[];
}

interface UsePendingSessionReplayOptions {
  activeThreadId: string | null;
  isCreatingThread: boolean;
  isRunning: boolean;
  isHistoryLoading: boolean;
  isSessionSwitching: boolean;
  consumePendingSessionMessage: (threadId: string) => PendingSessionReplayEntry | null;
  onBeforeRun?: (message: string, threadId?: string) => void;
  setInputValue: (value: string) => void;
  sendMessageToThread: (
    threadIdForRun: string,
    message: string,
    reasoningMode?: boolean,
    attachments?: ChatAttachment[],
    knowledgeSourceIds?: number[],
  ) => Promise<void>;
}

export function usePendingSessionReplay({
  activeThreadId,
  isCreatingThread,
  isRunning,
  isHistoryLoading,
  isSessionSwitching,
  consumePendingSessionMessage,
  onBeforeRun,
  setInputValue,
  sendMessageToThread,
}: UsePendingSessionReplayOptions): void {
  useEffect(() => {
    if (
      !activeThreadId ||
      isCreatingThread ||
      isRunning ||
      isHistoryLoading ||
      isSessionSwitching
    ) {
      return;
    }

    const pendingEntry = consumePendingSessionMessage(activeThreadId);
    if (!pendingEntry) return;

    onBeforeRun?.(pendingEntry.message, activeThreadId);
    setInputValue("");
    void sendMessageToThread(
      activeThreadId,
      pendingEntry.message,
      pendingEntry.reasoningMode,
      pendingEntry.attachments,
      pendingEntry.knowledgeSourceIds,
    );
  }, [
    activeThreadId,
    consumePendingSessionMessage,
    isCreatingThread,
    isHistoryLoading,
    isRunning,
    isSessionSwitching,
    onBeforeRun,
    sendMessageToThread,
    setInputValue,
  ]);
}
