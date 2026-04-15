"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatTimelineItem } from "../types";
import { SESSION_SWITCH_LOADING_DELAY_MS } from "../types";
import { normalizeHistoryTimeline } from "../utils";
import { fetchHistoryPage, resolveHistoryPaging } from "./chatHistoryApi";
import {
  consumeSkipInitialHistory,
  hasSkipInitialHistory,
} from "@/lib/skipInitialHistory";

export interface UseChatHistoryReturn {
  timeline: ChatTimelineItem[];
  setTimeline: React.Dispatch<React.SetStateAction<ChatTimelineItem[]>>;
  activeThreadId: string | null;
  isHistoryLoading: boolean;
  isLoadingMoreHistory: boolean;
  hasMoreHistory: boolean;
  loadOlderHistory: () => Promise<boolean>;
  historyResolvedThreadId: string | null;
  historyError: string | null;
  isSessionSwitching: boolean;
  isConversationVisible: boolean;
  showSessionSwitchingLoader: boolean;
  handleConversationExitComplete: () => void;
  /** Call when the running stream's abort controller should be aborted externally. */
  abortRunRef: React.MutableRefObject<AbortController | null>;
}

export function useChatHistory(
  threadId: string | null,
  onRunningChange?: (isRunning: boolean) => void,
): UseChatHistoryReturn {
  const [timeline, setTimeline] = useState<ChatTimelineItem[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(threadId);
  const [isConversationVisible, setIsConversationVisible] = useState(true);
  const [isSessionSwitching, setIsSessionSwitching] = useState(false);
  const [showSessionSwitchingLoader, setShowSessionSwitchingLoader] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [historyResolvedThreadId, setHistoryResolvedThreadId] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const abortRunRef = useRef<AbortController | null>(null);
  const sessionSwitchLoaderTimerRef = useRef<number | null>(null);
  const skipSessionSwitchLoaderRef = useRef(false);
  const lastHistoryThreadIdRef = useRef<string | null>(activeThreadId);
  const latestThreadIdRef = useRef<string | null>(activeThreadId);

  useEffect(() => {
    latestThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  const clearSessionSwitchLoaderTimer = useCallback(() => {
    if (sessionSwitchLoaderTimerRef.current !== null) {
      window.clearTimeout(sessionSwitchLoaderTimerRef.current);
      sessionSwitchLoaderTimerRef.current = null;
    }
  }, []);

  const loadOlderHistory = useCallback(async () => {
    const threadForLoad = activeThreadId;
    if (!threadForLoad || isHistoryLoading || isLoadingMoreHistory || !hasMoreHistory || historyCursor === null) {
      return false;
    }

    setIsLoadingMoreHistory(true);

    try {
      const data = await fetchHistoryPage(threadForLoad, { before: historyCursor });

      if (latestThreadIdRef.current !== threadForLoad) {
        return false;
      }

      const normalized = normalizeHistoryTimeline(data.messages);
      if (normalized.length > 0) {
        setTimeline((prev) => {
          const existingIds = new Set(prev.map((item) => item.id));
          const deduped = normalized.filter((item) => !existingIds.has(item.id));
          return deduped.length > 0 ? [...deduped, ...prev] : prev;
        });
      }

      const nextPaging = resolveHistoryPaging(data.paging);
      setHistoryCursor(nextPaging.nextBefore);
      setHasMoreHistory(nextPaging.hasMoreHistory);
      return normalized.length > 0;
    } catch (error) {
      if (latestThreadIdRef.current === threadForLoad) {
        setHistoryError(error instanceof Error ? error.message : "加载更多历史失败");
      }
      return false;
    } finally {
      if (latestThreadIdRef.current === threadForLoad) {
        setIsLoadingMoreHistory(false);
      }
    }
  }, [activeThreadId, hasMoreHistory, historyCursor, isHistoryLoading, isLoadingMoreHistory]);

  // ── Session switch detection ─────────────────────────────
  useEffect(() => {
    if (threadId === activeThreadId) {
      skipSessionSwitchLoaderRef.current = false;
      return;
    }

    skipSessionSwitchLoaderRef.current = Boolean(
      threadId && hasSkipInitialHistory(threadId),
    );
    abortRunRef.current?.abort();
    abortRunRef.current = null;
    onRunningChange?.(false);
    setIsSessionSwitching(true);
    setShowSessionSwitchingLoader(false);
    setIsConversationVisible(false);
  }, [activeThreadId, onRunningChange, threadId]);

  // ── Delayed session-switch loader ────────────────────────
  useEffect(() => {
    if (!isHistoryLoading || skipSessionSwitchLoaderRef.current) {
      clearSessionSwitchLoaderTimer();
      setShowSessionSwitchingLoader(false);
      return;
    }

    setShowSessionSwitchingLoader(false);
    sessionSwitchLoaderTimerRef.current = window.setTimeout(() => {
      setShowSessionSwitchingLoader(true);
      sessionSwitchLoaderTimerRef.current = null;
    }, SESSION_SWITCH_LOADING_DELAY_MS);

    return () => {
      clearSessionSwitchLoaderTimer();
    };
  }, [clearSessionSwitchLoaderTimer, isHistoryLoading]);

  const handleConversationExitComplete = useCallback(() => {
    if (threadId === activeThreadId) {
      return;
    }
    setActiveThreadId(threadId);
  }, [activeThreadId, threadId]);

  // ── Load latest history page when activeThreadId changes ─
  useEffect(() => {
    const didThreadChange = lastHistoryThreadIdRef.current !== activeThreadId;
    lastHistoryThreadIdRef.current = activeThreadId;

    if (didThreadChange) {
      setTimeline([]);
      setHistoryResolvedThreadId(null);
      setHistoryCursor(null);
      setHasMoreHistory(false);
      setIsLoadingMoreHistory(false);
    }

    if (!activeThreadId) {
      abortRunRef.current?.abort();
      abortRunRef.current = null;
      onRunningChange?.(false);
      setTimeline([]);
      setIsHistoryLoading(false);
      setIsLoadingMoreHistory(false);
      setHistoryCursor(null);
      setHasMoreHistory(false);
      setHistoryResolvedThreadId(null);
      setHistoryError(null);
      return;
    }

    if (consumeSkipInitialHistory(activeThreadId)) {
      setIsHistoryLoading(false);
      setIsLoadingMoreHistory(false);
      setHistoryCursor(null);
      setHasMoreHistory(false);
      setHistoryResolvedThreadId(activeThreadId);
      setHistoryError(null);
      return;
    }

    abortRunRef.current?.abort();
    abortRunRef.current = null;
    onRunningChange?.(false);

    let cancelled = false;
    const targetThreadId = activeThreadId;
    const controller = new AbortController();
    setIsHistoryLoading(true);
    setHistoryError(null);

    const loadHistory = async () => {
      try {
        const data = await fetchHistoryPage(targetThreadId, {
          signal: controller.signal,
        });

        if (cancelled) {
          return;
        }

        setTimeline(normalizeHistoryTimeline(data.messages));

        const nextPaging = resolveHistoryPaging(data.paging);
        setHistoryCursor(nextPaging.nextBefore);
        setHasMoreHistory(nextPaging.hasMoreHistory);
      } catch (error) {
        if (controller.signal.aborted || cancelled) {
          return;
        }
        setHistoryError(error instanceof Error ? error.message : "加载历史失败");
        setTimeline([]);
        setHistoryCursor(null);
        setHasMoreHistory(false);
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
          setHistoryResolvedThreadId(targetThreadId);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeThreadId, onRunningChange]);

  // ── Finish session switch after history loads ────────────
  useEffect(() => {
    if (!isSessionSwitching || isHistoryLoading) {
      return;
    }
    if (activeThreadId !== threadId) {
      return;
    }
    setIsConversationVisible(true);
    setIsSessionSwitching(false);
    skipSessionSwitchLoaderRef.current = false;
    setShowSessionSwitchingLoader(false);
  }, [activeThreadId, isHistoryLoading, isSessionSwitching, threadId]);

  // ── Cleanup on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      clearSessionSwitchLoaderTimer();
    };
  }, [clearSessionSwitchLoaderTimer]);

  return {
    timeline,
    setTimeline,
    activeThreadId,
    isHistoryLoading,
    isLoadingMoreHistory,
    hasMoreHistory,
    loadOlderHistory,
    historyResolvedThreadId,
    historyError,
    isSessionSwitching,
    isConversationVisible,
    showSessionSwitchingLoader,
    handleConversationExitComplete,
    abortRunRef,
  };
}
