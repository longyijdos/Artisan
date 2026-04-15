"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ChatPanelProps } from "./types";
import {
  useChatHistory,
  useChatScroll,
  useChatStream,
  useComposerAttachments,
} from "./hooks";
import { upsertToolCall } from "./utils";
import { ChatTimeline } from "./ChatTimeline";
import { ChatComposer } from "./ChatComposer";
import { useChatComposerFlow, useSharedComposerInput, useSharedReasoningEnabled, useSharedSelectedKnowledgeIds } from "@/components/ChatComposerFlowProvider";
import { useToast } from "@/components/Toast";
import {
  shouldShowWelcomeCard,
  getReadyComposerAttachments,
  hasUploadingComposerAttachments,
} from "./hooks/chatPanelUtils";
import { useChatHistoryPagination } from "./hooks/useChatHistoryPagination";
import { useChatPanelConversationState } from "./hooks/useChatPanelConversationState";
import { usePendingSessionReplay } from "./hooks/usePendingSessionReplay";

export function ChatPanel({
  threadId,
  onBeforeRun,
  onRequestCreateThread,
  onRunningChange,
}: ChatPanelProps) {
  const { showToast } = useToast();
  const [inputValue, setInputValue] = useSharedComposerInput();
  const [reasoningEnabled, setReasoningEnabled] = useSharedReasoningEnabled();
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useSharedSelectedKnowledgeIds();
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [isAwaitingThreadActivation, setIsAwaitingThreadActivation] = useState(false);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const { consumePendingSessionMessage, setPendingSessionMessage } = useChatComposerFlow();

  // ── Hooks ────────────────────────────────────────────────
  const {
    scrollRef,
    contentRef,
    scrollToBottom,
    isAtBottom: isAtBottomPosition,
    composerRef,
  } = useChatScroll();

  const {
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
  } = useChatHistory(threadId, onRunningChange);

  const {
    runStream,
    stop,
    sendMessageToThread,
    isRunning,
    preRunToolIdsRef,
    tokenUsage,
  } = useChatStream(
    setTimeline,
    abortRunRef,
    activeThreadId,
    isHistoryLoading,
    isSessionSwitching,
    scrollToBottom,
    onRunningChange,
  );

  const timelineContentRef = useRef<HTMLDivElement | null>(null);
  const draftThreadIdRef = useRef<string | null>(null);
  const {
    composerAttachments,
    setComposerAttachments,
    onPickFiles,
    onRemoveAttachment,
  } = useComposerAttachments({
    activeThreadId,
    draftThreadIdRef,
    isRunning,
    isHistoryLoading,
    isSessionSwitching,
    isCreatingThread,
    onRequestCreateThread,
    setIsCreatingThread,
    setIsAwaitingThreadActivation,
    onDeleteFailed: (message) => showToast("warning", message),
  });
  useChatPanelConversationState({
    activeThreadId,
    routeThreadId: threadId,
    draftThreadIdRef,
    isAwaitingThreadActivation,
    setIsAwaitingThreadActivation,
    setReasoningEnabled,
    setSelectedKnowledgeIds,
    setComposerAttachments,
  });

  const toggleReasoningEnabled = useCallback(() => {
    setReasoningEnabled(!reasoningEnabled);
  }, [reasoningEnabled, setReasoningEnabled]);

  // ── Derived state ────────────────────────────────────────
  const displayTimeline = timeline;
  const showWelcomeCard = shouldShowWelcomeCard({
    timelineLength: displayTimeline.length,
    isHistoryLoading,
    hasHistoryError: Boolean(historyError),
    isSessionSwitching,
    isAwaitingThreadActivation,
    activeThreadId,
    isCreatingThread,
    historyResolvedThreadId,
  });

  // ── Scroll to bottom on conversation visible ─────────────
  useLayoutEffect(() => {
    if (isConversationVisible && !isHistoryLoading) {
      scrollToBottom({ animation: "instant" });
    }
  }, [isConversationVisible, isHistoryLoading, scrollToBottom]);

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  const handleScrollRef = useCallback((node: HTMLDivElement | null) => {
    setScrollContainer(node);
    scrollRef(node);
  }, [scrollRef]);

  useChatHistoryPagination({
    scrollContainer,
    isHistoryLoading,
    isLoadingMoreHistory,
    hasMoreHistory,
    loadOlderHistory,
  });

  usePendingSessionReplay({
    activeThreadId,
    isCreatingThread,
    isRunning,
    isHistoryLoading,
    isSessionSwitching,
    consumePendingSessionMessage,
    onBeforeRun,
    setInputValue,
    sendMessageToThread,
  });

  const send = useCallback(async () => {
    const message = inputValue.trim();
    const readyAttachments = getReadyComposerAttachments(composerAttachments);
    const hasUploadingAttachment = hasUploadingComposerAttachments(composerAttachments);

    if (!message || hasUploadingAttachment || isRunning || isHistoryLoading || isSessionSwitching || isCreatingThread) return;

    const targetThreadId = activeThreadId ?? draftThreadIdRef.current;
    if (!targetThreadId) {
      if (!onRequestCreateThread) return;
      setIsCreatingThread(true);
      setIsAwaitingThreadActivation(true);
      try {
        const createdThreadId = await onRequestCreateThread();
        if (!createdThreadId) {
          setIsAwaitingThreadActivation(false);
          return;
        }
        draftThreadIdRef.current = createdThreadId;
        setPendingSessionMessage(createdThreadId, message, reasoningEnabled, readyAttachments, selectedKnowledgeIds);
        setInputValue("");
        setComposerAttachments([]);
        return;
      } finally {
        setIsCreatingThread(false);
      }
    }

    if (!targetThreadId) return;

    onBeforeRun?.(message);
    setInputValue("");
    setComposerAttachments([]);
    await sendMessageToThread(targetThreadId, message, reasoningEnabled, readyAttachments, selectedKnowledgeIds);
  }, [
    activeThreadId,
    composerAttachments,
    inputValue,
    isCreatingThread,
    isHistoryLoading,
    isRunning,
    isSessionSwitching,
    onBeforeRun,
    onRequestCreateThread,
    reasoningEnabled,
    selectedKnowledgeIds,
    setComposerAttachments,
    setInputValue,
    setPendingSessionMessage,
    sendMessageToThread,
  ]);

  // ── Frontend tool submit ─────────────────────────────────
  const onAskUserSubmit = useCallback(
    async (toolCallId: string, data: Record<string, string>) => {
      if (!activeThreadId || isRunning || isHistoryLoading || isSessionSwitching) return;

      const toolResult = { status: "success", data };
      setTimeline((prev) =>
        upsertToolCall(prev, {
          kind: "tool",
          id: `tool-${toolCallId}`,
          toolCallId,
          toolName: "ask_user",
          args: {},
          result: toolResult,
          status: "complete",
        }),
      );

      await runStream(activeThreadId, { toolCallId, toolResult, reasoningMode: reasoningEnabled });
    },
    [activeThreadId, isHistoryLoading, isRunning, isSessionSwitching, reasoningEnabled, runStream, setTimeline],
  );

  const handleExampleClick = useCallback((text: string) => {
    setInputValue(text);
    const textarea = composerRef.current?.querySelector("textarea");
    if (textarea) {
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = text.length;
      }, 0);
    }
  }, [composerRef, setInputValue]);

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="relative h-full flex flex-col">
      <div
        ref={handleScrollRef}
        className="flex-1 min-h-0 overflow-y-auto pt-5 [overflow-anchor:none] md:pt-7 pb-4"
      >
        {isSessionSwitching && !isConversationVisible && showSessionSwitchingLoader && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex min-h-[46vh] w-full items-center justify-center"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-white/92 px-5 py-4 shadow-[0_14px_30px_-22px_rgba(79,70,229,0.55)]">
              <span className="relative inline-flex h-5 w-5">
                <span className="absolute inset-0 rounded-full border-2 border-indigo-200" />
                <span className="absolute inset-0 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-slate-700">正在切换会话</p>
                <p className="text-xs text-slate-500">历史消息加载中...</p>
              </div>
            </div>
          </motion.div>
        )}
        <AnimatePresence mode="wait" onExitComplete={handleConversationExitComplete}>
          {isConversationVisible && (
            <motion.div
              ref={(node: HTMLDivElement | null) => {
                timelineContentRef.current = node;
                contentRef(node);
              }}
              key={activeThreadId ?? "__no_thread__"}
              initial={{ opacity: 0, y: 6, filter: "blur(1px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -6, filter: "blur(1px)" }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative w-full max-w-[780px] mx-auto space-y-4 px-4 md:px-8"
            >
              <ChatTimeline
                displayTimeline={displayTimeline}
                isRunning={isRunning}
                isHistoryLoading={isHistoryLoading}
                historyError={historyError}
                showSessionSwitchingLoader={showSessionSwitchingLoader}
                shouldShowWelcomeCard={showWelcomeCard}
                preRunToolIds={preRunToolIdsRef.current}
                onAskUserSubmit={onAskUserSubmit}
                onExampleClick={handleExampleClick}
                scrollContainer={scrollContainer}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative flex-shrink-0">
        <AnimatePresence>
          {!isAtBottomPosition && (
            <motion.div
              key="scroll-to-bottom"
              initial={{ opacity: 0, y: 8, scale: 0.6 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.6 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute left-0 right-0 z-30 -top-12"
            >
              <div className="max-w-[780px] mx-auto flex justify-center">
              <button
                type="button"
                onClick={handleScrollToBottom}
                className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-indigo-200 bg-white text-indigo-700 shadow-md shadow-indigo-100 transition-colors hover:bg-indigo-50 hover:text-indigo-800"
                aria-label="回到底部"
                title="回到底部"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7-7-7M12 3v18" />
                </svg>
              </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-4 md:px-6 pb-[20px] pt-2">
          <div className="w-full max-w-[780px] mx-auto">
            <ChatComposer
              inputValue={inputValue}
              onInputChange={setInputValue}
              onSend={send}
              onStop={stop}
              reasoningEnabled={reasoningEnabled}
              onReasoningToggle={toggleReasoningEnabled}
              selectedKnowledgeIds={selectedKnowledgeIds}
              onKnowledgeIdsChange={setSelectedKnowledgeIds}
              attachments={composerAttachments}
              onPickFiles={onPickFiles}
              onRemoveAttachment={onRemoveAttachment}
              isRunning={isRunning}
              isDisabled={isHistoryLoading || isSessionSwitching || isCreatingThread}
              composerRef={composerRef}
              activeThreadId={activeThreadId}
              tokenUsage={tokenUsage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
