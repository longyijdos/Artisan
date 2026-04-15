"use client";

import { useCallback, useEffect, useState } from "react";
import type { ComposerAttachment } from "../types";
import { useChatComposerFlow } from "@/components/ChatComposerFlowProvider";
import type {
  WorkspaceDeleteResponseContract,
  WorkspaceUploadResponseContract,
} from "@/lib/workspace/contracts";

interface UseComposerAttachmentsOptions {
  activeThreadId: string | null;
  draftThreadIdRef: React.MutableRefObject<string | null>;
  isRunning: boolean;
  isHistoryLoading: boolean;
  isSessionSwitching: boolean;
  isCreatingThread: boolean;
  onRequestCreateThread?: () => Promise<string | null>;
  setIsCreatingThread: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAwaitingThreadActivation: React.Dispatch<React.SetStateAction<boolean>>;
  onDeleteFailed?: (message: string) => void;
}

export interface UseComposerAttachmentsReturn {
  composerAttachments: ComposerAttachment[];
  setComposerAttachments: React.Dispatch<React.SetStateAction<ComposerAttachment[]>>;
  onPickFiles: (files: File[]) => Promise<void>;
  onRemoveAttachment: (attachmentId: string) => void;
}

export function useComposerAttachments({
  activeThreadId,
  draftThreadIdRef,
  isRunning,
  isHistoryLoading,
  isSessionSwitching,
  isCreatingThread,
  onRequestCreateThread,
  setIsCreatingThread,
  setIsAwaitingThreadActivation,
  onDeleteFailed,
}: UseComposerAttachmentsOptions): UseComposerAttachmentsReturn {
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const { consumePendingUploadFiles, setPendingUploadFiles } = useChatComposerFlow();

  const updateComposerAttachments = useCallback(
    (updater: (prev: ComposerAttachment[]) => ComposerAttachment[]) => {
      setComposerAttachments((prev) => updater(prev));
    },
    [],
  );

  const uploadFilesToThread = useCallback(async (targetThreadId: string, files: File[]) => {
    if (!targetThreadId || !files || files.length === 0) return;
    const fileList = files;
    const newItems: ComposerAttachment[] = fileList.map((file) => ({
      id: `att-${crypto.randomUUID()}`,
      name: file.name,
      path: `upload/${file.name}`,
      size: file.size,
      mimeType: file.type || undefined,
      uploadStatus: "uploading",
      progress: 20,
    }));

    updateComposerAttachments((prev) => [...prev, ...newItems]);

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const file = fileList[i] ?? null;
      if (!file) {
        updateComposerAttachments((prev) =>
          prev.map((entry) => {
            if (entry.id !== item.id) return entry;
            return { ...entry, uploadStatus: "error", progress: 100 };
          }),
        );
        continue;
      }

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch(
          `/api/workspace/upload?path=${encodeURIComponent("upload")}&thread_id=${encodeURIComponent(targetThreadId)}`,
          {
            method: "POST",
            body: formData,
          },
        );
        const data = await response
          .json()
          .catch(() => ({}) as WorkspaceUploadResponseContract);
        const uploadedPath =
          data && typeof data.path === "string" && data.path.trim()
            ? data.path
            : item.path;

        updateComposerAttachments((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  path: uploadedPath,
                  uploadStatus: response.ok ? "ready" : "error",
                  progress: 100,
                }
              : entry,
          ),
        );
      } catch {
        updateComposerAttachments((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? { ...entry, uploadStatus: "error", progress: 100 }
              : entry,
          ),
        );
      }
    }
  }, [updateComposerAttachments]);

  const onPickFiles = useCallback(async (files: File[]) => {
    if (isRunning || isHistoryLoading || isSessionSwitching || isCreatingThread) return;
    if (!files || files.length === 0) return;

    if (activeThreadId) {
      await uploadFilesToThread(activeThreadId, files);
      return;
    }

    const pendingDraftThreadId = draftThreadIdRef.current;
    if (pendingDraftThreadId) {
      setPendingUploadFiles(pendingDraftThreadId, files);
      return;
    }

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
      setPendingUploadFiles(createdThreadId, files);
    } finally {
      setIsCreatingThread(false);
    }
  }, [
    activeThreadId,
    draftThreadIdRef,
    isCreatingThread,
    isHistoryLoading,
    isRunning,
    isSessionSwitching,
    onRequestCreateThread,
    setPendingUploadFiles,
    setIsAwaitingThreadActivation,
    setIsCreatingThread,
    uploadFilesToThread,
  ]);

  useEffect(() => {
    if (!activeThreadId) return;
    if (isRunning || isHistoryLoading || isSessionSwitching) return;
    const pendingFiles = consumePendingUploadFiles(activeThreadId);
    if (!pendingFiles || pendingFiles.length === 0) return;
    void uploadFilesToThread(activeThreadId, pendingFiles);
  }, [
    activeThreadId,
    consumePendingUploadFiles,
    isHistoryLoading,
    isRunning,
    isSessionSwitching,
    uploadFilesToThread,
  ]);

  const onRemoveAttachment = useCallback((attachmentId: string) => {
    const targetThreadId = activeThreadId ?? draftThreadIdRef.current;
    const removedAttachment = composerAttachments.find((item) => item.id === attachmentId);
    setComposerAttachments((prev) => prev.filter((item) => item.id !== attachmentId));

    if (!targetThreadId || !removedAttachment?.path) {
      return;
    }

    void fetch(
      `/api/workspace/delete?path=${encodeURIComponent(removedAttachment.path)}&thread_id=${encodeURIComponent(targetThreadId)}`,
      { method: "DELETE" },
    )
      .then(async (response) => {
        if (response.ok) return;
        const payload = await response
          .json()
          .catch(() => ({}) as WorkspaceDeleteResponseContract);
        const detail =
          payload && typeof payload.detail === "string" && payload.detail.trim()
            ? payload.detail.trim()
            : "删除失败";
        onDeleteFailed?.(`附件已移除，但文件删除失败：${detail}`);
      })
      .catch(() => {
        onDeleteFailed?.("附件已移除，但文件删除失败");
      });
  }, [
    activeThreadId,
    composerAttachments,
    draftThreadIdRef,
    onDeleteFailed,
  ]);

  return {
    composerAttachments,
    setComposerAttachments,
    onPickFiles,
    onRemoveAttachment,
  };
}
