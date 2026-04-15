"use client";

import { useMemo } from "react";
import { ChatCanvasLayout } from "@/components/Layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { SessionSidebar } from "@/components/SessionSidebar";
import { TerminalView } from "@/components/TerminalView";
import { SkillsLibrary } from "@/components/SkillsLibrary";
import { KnowledgePanel } from "@/components/KnowledgePanel/KnowledgePanel";
import { ChatPanel } from "@/components/ChatPanel";
import { usePanelLayout, useSkills, useSessionNavigation } from "./hooks";

export default function ArtisanPage() {
  const {
    currentSessionId,
    hasSelectedSession,
    sessions,
    isSessionLoading,
    isAgentRunning,
    setIsAgentRunning,
    updateSessionTitle,
    guardedSwitchSession,
    handleSidebarCreateSession,
    handleRequestCreateThread,
    handleDeleteSession,
    handleBeforeRun,
  } = useSessionNavigation();

  const {
    activePanel,
    showWorkspace,
    showTerminal,
    showSkills,
    showKnowledge,
    toggleWorkspace,
    toggleTerminal,
    toggleSkills,
    toggleKnowledge,
    closePanel,
  } = usePanelLayout(currentSessionId);

  const {
    skills,
    isSkillsLoading,
    skillsError,
    fetchSkills,
    handleUpdateSkill,
  } = useSkills(currentSessionId, isSessionLoading);

  // Chat panel - no wrapper, directly on the canvas
  const chatPanelContent = useMemo(() => (
    <ChatPanel
      threadId={currentSessionId}
      onBeforeRun={handleBeforeRun}
      onRequestCreateThread={handleRequestCreateThread}
      onRunningChange={setIsAgentRunning}
    />
  ), [currentSessionId, handleBeforeRun, handleRequestCreateThread, setIsAgentRunning]);

  // Workspace panel
  const workspacePanel = useMemo(() => (
    <WorkspacePanel
      threadId={currentSessionId}
      visible={showWorkspace}
      onClose={closePanel}
    />
  ), [currentSessionId, showWorkspace, closePanel]);

  // Terminal panel
  const terminalPanel = useMemo(() => (
    <TerminalView sessionId={currentSessionId || ""} onClose={closePanel} />
  ), [currentSessionId, closePanel]);

  // Skills panel
  const skillsPanel = useMemo(() => (
    <SkillsLibrary
      sessionId={currentSessionId || ""}
      skills={skills}
      loading={isSkillsLoading}
      error={skillsError}
      onRefresh={fetchSkills}
      onUpdateSkill={handleUpdateSkill}
      onClose={closePanel}
    />
  ), [currentSessionId, skills, isSkillsLoading, skillsError, fetchSkills, handleUpdateSkill, closePanel]);

  // Knowledge panel
  const knowledgePanel = useMemo(() => (
    <KnowledgePanel onClose={closePanel} />
  ), [closePanel]);

  const rightPanelContent = useMemo(() => {
    if (!hasSelectedSession) return <div />;
    if (showWorkspace) return workspacePanel;
    if (showTerminal) return terminalPanel;
    if (showSkills) return skillsPanel;
    if (showKnowledge) return knowledgePanel;
    return <div />;
  }, [hasSelectedSession, showWorkspace, showTerminal, showSkills, showKnowledge, workspacePanel, terminalPanel, skillsPanel, knowledgePanel]);

  const showRightPanel = hasSelectedSession && activePanel !== null;

  // Derive the current session title for the header
  const currentSessionTitle = useMemo(() => {
    if (!currentSessionId) return undefined;
    const session = sessions.find((s) => s.id === currentSessionId);
    return session?.title;
  }, [currentSessionId, sessions]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Session Sidebar */}
      <SessionSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        isLoading={isSessionLoading}
        isAgentRunning={isAgentRunning}
        onCreateSession={handleSidebarCreateSession}
        onSelectSession={guardedSwitchSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={updateSessionTitle}
        showWorkspace={showWorkspace}
        onToggleWorkspace={toggleWorkspace}
        showTerminal={showTerminal}
        onToggleTerminal={toggleTerminal}
        showSkills={showSkills}
        onToggleSkills={toggleSkills}
        showKnowledge={showKnowledge}
        onToggleKnowledge={toggleKnowledge}
      />

      {/* Main Canvas */}
      <div className="flex-1 min-w-0 h-full">
        <ChatCanvasLayout
          chatPanel={chatPanelContent}
          rightPanel={rightPanelContent}
          showRight={showRightPanel}
          rightWidth={800}
          rightPanelDark={showTerminal}
          title={currentSessionTitle}
        />
      </div>
    </div>
  );
}
