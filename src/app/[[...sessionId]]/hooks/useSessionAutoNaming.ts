"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Session, SessionStore } from "@/lib/session/types";

interface UseSessionAutoNamingOptions {
  currentSessionId: string | null;
  sessions: Session[];
  autoNameSession: SessionStore["autoNameSession"];
  updateSessionTitle: SessionStore["updateSessionTitle"];
}

export function useSessionAutoNaming({
  currentSessionId,
  sessions,
  autoNameSession,
  updateSessionTitle,
}: UseSessionAutoNamingOptions) {
  const autoNameTriggeredRef = useRef<string | null>(null);

  useEffect(() => {
    autoNameTriggeredRef.current = null;
  }, [currentSessionId]);

  return useCallback(
    (messageText: string, explicitThreadId?: string) => {
      const targetSessionId = explicitThreadId ?? currentSessionId;
      if (!targetSessionId) return;
      if (autoNameTriggeredRef.current === targetSessionId) return;

      const currentSession = sessions.find((session) => session.id === targetSessionId);
      if (
        currentSession &&
        currentSession.title !== "新对话" &&
        currentSession.title !== "New Chat"
      ) {
        return;
      }

      autoNameTriggeredRef.current = targetSessionId;
      autoNameSession(messageText).then((newTitle) => {
        if (!newTitle) {
          return;
        }

        void updateSessionTitle(targetSessionId, newTitle, { isAuto: true });
      });
    },
    [autoNameSession, currentSessionId, sessions, updateSessionTitle],
  );
}
