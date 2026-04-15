"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "@/components/Toast";

const PANEL_TRANSITION_MS = 320;

export type ActivePanel = "workspace" | "terminal" | "skills" | "knowledge" | null;

export interface UsePanelLayoutReturn {
  activePanel: ActivePanel;
  showWorkspace: boolean;
  showTerminal: boolean;
  showSkills: boolean;
  showKnowledge: boolean;
  toggleWorkspace: () => void;
  toggleTerminal: () => void;
  toggleSkills: () => void;
  toggleKnowledge: () => void;
  closePanel: () => void;
}

export function usePanelLayout(
  currentSessionId: string | null,
): UsePanelLayoutReturn {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const { showToast } = useToast();
  const hasSelectedSession = Boolean(currentSessionId);

  const pendingPanelTimerRef = useRef<number | null>(null);
  const scheduleAfterPanelClose = useCallback(
    (fn: () => void) => {
      if (pendingPanelTimerRef.current) {
        window.clearTimeout(pendingPanelTimerRef.current);
      }
      pendingPanelTimerRef.current = window.setTimeout(() => {
        pendingPanelTimerRef.current = null;
        fn();
      }, PANEL_TRANSITION_MS);
    },
    [],
  );

  // Reset on session switch
  /* eslint-disable react-hooks/set-state-in-effect -- intentional batch reset on session change */
  useEffect(() => {
    if (pendingPanelTimerRef.current) {
      window.clearTimeout(pendingPanelTimerRef.current);
      pendingPanelTimerRef.current = null;
    }
    if (!currentSessionId) {
      setActivePanel(null);
    }
  }, [currentSessionId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (pendingPanelTimerRef.current) {
        window.clearTimeout(pendingPanelTimerRef.current);
        pendingPanelTimerRef.current = null;
      }
    };
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  const togglePanel = useCallback(
    (panel: ActivePanel, label: string) => {
      if (!hasSelectedSession) {
        showToast("warning", `请先选择或创建一个会话再打开${label}`);
        return;
      }
      if (activePanel === panel) {
        // Close current panel
        setActivePanel(null);
        return;
      }
      if (activePanel !== null) {
        // Another panel is open - close it first, then open new one
        setActivePanel(null);
        scheduleAfterPanelClose(() => {
          setActivePanel(panel);
        });
        return;
      }
      // No panel open - just open it
      setActivePanel(panel);
    },
    [activePanel, hasSelectedSession, scheduleAfterPanelClose, showToast],
  );

  const toggleWorkspace = useCallback(() => togglePanel("workspace", "工作区"), [togglePanel]);
  const toggleTerminal = useCallback(() => togglePanel("terminal", "控制台"), [togglePanel]);
  const toggleSkills = useCallback(() => togglePanel("skills", "技能库"), [togglePanel]);
  const toggleKnowledge = useCallback(() => togglePanel("knowledge", "知识库"), [togglePanel]);

  return {
    activePanel,
    showWorkspace: activePanel === "workspace",
    showTerminal: activePanel === "terminal",
    showSkills: activePanel === "skills",
    showKnowledge: activePanel === "knowledge",
    toggleWorkspace,
    toggleTerminal,
    toggleSkills,
    toggleKnowledge,
    closePanel,
  };
}
