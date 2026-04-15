import type { ChatAttachment, ComposerAttachment } from "../types";

interface ShouldShowWelcomeCardOptions {
  timelineLength: number;
  isHistoryLoading: boolean;
  hasHistoryError: boolean;
  isSessionSwitching: boolean;
  isAwaitingThreadActivation: boolean;
  activeThreadId: string | null;
  isCreatingThread: boolean;
  historyResolvedThreadId: string | null;
}

export function shouldShowWelcomeCard({
  timelineLength,
  isHistoryLoading,
  hasHistoryError,
  isSessionSwitching,
  isAwaitingThreadActivation,
  activeThreadId,
  isCreatingThread,
  historyResolvedThreadId,
}: ShouldShowWelcomeCardOptions): boolean {
  return (
    timelineLength === 0 &&
    !isHistoryLoading &&
    !hasHistoryError &&
    !isSessionSwitching &&
    !isAwaitingThreadActivation &&
    (activeThreadId === null
      ? !isCreatingThread
      : historyResolvedThreadId === activeThreadId)
  );
}

export function toChatAttachment(item: ComposerAttachment): ChatAttachment {
  return {
    id: item.id,
    name: item.name,
    path: item.path,
    size: item.size,
    mimeType: item.mimeType,
  };
}

export function getReadyComposerAttachments(
  attachments: ComposerAttachment[],
): ChatAttachment[] {
  return attachments
    .filter((item) => item.uploadStatus === "ready")
    .map(toChatAttachment);
}

export function hasUploadingComposerAttachments(
  attachments: ComposerAttachment[],
): boolean {
  return attachments.some((item) => item.uploadStatus === "uploading");
}
