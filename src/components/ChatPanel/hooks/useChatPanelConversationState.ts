"use client";

import { useEffect, useRef } from "react";
import type { ComposerAttachment } from "../types";

interface UseChatPanelConversationStateOptions {
  activeThreadId: string | null;
  routeThreadId: string | null;
  draftThreadIdRef: React.MutableRefObject<string | null>;
  isAwaitingThreadActivation: boolean;
  setIsAwaitingThreadActivation: React.Dispatch<React.SetStateAction<boolean>>;
  setReasoningEnabled: (value: boolean) => void;
  setSelectedKnowledgeIds: (ids: number[]) => void;
  setComposerAttachments: React.Dispatch<React.SetStateAction<ComposerAttachment[]>>;
}

export function useChatPanelConversationState({
  activeThreadId,
  routeThreadId,
  draftThreadIdRef,
  isAwaitingThreadActivation,
  setIsAwaitingThreadActivation,
  setReasoningEnabled,
  setSelectedKnowledgeIds,
  setComposerAttachments,
}: UseChatPanelConversationStateOptions): void {
  const prevActiveThreadIdRef = useRef<string | null>(activeThreadId);

  useEffect(() => {
    if (!isAwaitingThreadActivation) return;
    if (routeThreadId || activeThreadId) {
      setIsAwaitingThreadActivation(false);
    }
  }, [
    activeThreadId,
    isAwaitingThreadActivation,
    routeThreadId,
    setIsAwaitingThreadActivation,
  ]);

  useEffect(() => {
    const prevThreadId = prevActiveThreadIdRef.current;
    const nextThreadId = activeThreadId;

    if (prevThreadId !== nextThreadId) {
      // Only reset composer state when switching between two existing sessions,
      // not when going from no session (null) to a newly created one.
      if (prevThreadId !== null && nextThreadId !== null) {
        setReasoningEnabled(false);
        setSelectedKnowledgeIds([]);
        setComposerAttachments([]);
      }
    }

    if (nextThreadId && draftThreadIdRef.current) {
      draftThreadIdRef.current = null;
    }

    prevActiveThreadIdRef.current = nextThreadId;
  }, [
    activeThreadId,
    draftThreadIdRef,
    setComposerAttachments,
    setReasoningEnabled,
    setSelectedKnowledgeIds,
  ]);
}
