"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSessionContext } from "@/components/SessionProvider";
import { useToast } from "@/components/Toast";
import { markSkipInitialHistory } from "@/lib/skipInitialHistory";
import { useSessionAutoNaming } from "./useSessionAutoNaming";
import { toSessionPath, useRouteSessionState } from "./useRouteSessionState";

export interface UseSessionNavigationReturn {
  currentSessionId: string | null;
  hasSelectedSession: boolean;
  sessions: ReturnType<typeof useSessionContext>["sessions"];
  isSessionLoading: boolean;
  sessionError: ReturnType<typeof useSessionContext>["error"];
  updateSessionTitle: ReturnType<typeof useSessionContext>["updateSessionTitle"];
  isAgentRunning: boolean;
  setIsAgentRunning: (running: boolean) => void;
  guardedSwitchSession: (id: string) => void;
  handleSidebarCreateSession: () => void;
  handleRequestCreateThread: () => Promise<string | null>;
  handleDeleteSession: (id: string) => Promise<boolean>;
  handleBeforeRun: (messageText: string, explicitThreadId?: string) => void;
}

export function useSessionNavigation(): UseSessionNavigationReturn {
  const router = useRouter();
  const { showToast } = useToast();

  const {
    sessions,
    isLoading: isSessionLoading,
    error: sessionError,
    createSession,
    deleteSession,
    updateSessionTitle,
    autoNameSession,
  } = useSessionContext();

  const { currentSessionId, hasSelectedSession } = useRouteSessionState({
    sessions,
    isSessionLoading,
    sessionError,
  });

  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const isReallyGenerating = isAgentRunning;

  // --- Session actions ---
  const guardedSwitchSession = useCallback(
    (id: string) => {
      if (id === currentSessionId) return;
      if (isReallyGenerating) {
        showToast("warning", "AI 正在回复中，请等待生成完成或先停止生成再切换对话");
        return;
      }
      router.push(toSessionPath(id));
    },
    [isReallyGenerating, currentSessionId, router, showToast],
  );

  const createSessionWithNavigation = useCallback(
    async (mode: "push" | "replace" = "push"): Promise<string | null> => {
      if (isReallyGenerating) {
        showToast("warning", "AI 正在回复中，请等待生成完成或先停止生成再创建新对话");
        return null;
      }

      const created = await createSession();
      const createdSessionId = created?.id ?? null;
      if (!createdSessionId) {
        return null;
      }

      markSkipInitialHistory(createdSessionId);

      const nextPath = toSessionPath(createdSessionId);
      if (mode === "push") {
        router.push(nextPath);
      } else {
        router.replace(nextPath);
      }

      return createdSessionId;
    },
    [createSession, isReallyGenerating, router, showToast],
  );

  const handleSidebarCreateSession = useCallback(() => {
    void createSessionWithNavigation("push");
  }, [createSessionWithNavigation]);

  const handleRequestCreateThread = useCallback(() => {
    return createSessionWithNavigation("replace");
  }, [createSessionWithNavigation]);

  const handleDeleteSession = useCallback(
    async (id: string): Promise<boolean> => {
      const success = await deleteSession(id);
      if (!success) {
        return false;
      }
      if (id === currentSessionId) {
        router.replace("/");
      }
      return true;
    },
    [currentSessionId, deleteSession, router],
  );

  const handleBeforeRun = useSessionAutoNaming({
    currentSessionId,
    sessions,
    autoNameSession,
    updateSessionTitle,
  });

  return {
    currentSessionId,
    hasSelectedSession,
    sessions,
    isSessionLoading,
    sessionError,
    updateSessionTitle,
    isAgentRunning,
    setIsAgentRunning,
    guardedSwitchSession,
    handleSidebarCreateSession,
    handleRequestCreateThread,
    handleDeleteSession,
    handleBeforeRun,
  };
}
