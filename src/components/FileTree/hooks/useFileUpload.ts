"use client";

import { useState, useCallback, useRef, type DragEvent as ReactDragEvent } from "react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import type { WorkspaceUploadResponseContract } from "@/lib/workspace/contracts";
import type { UploadStatus } from "../types";

export interface UseFileUploadReturn {
  uploadStatuses: UploadStatus[];
  isDraggingOver: boolean;
  dragOverPath: string | null;
  handleContainerDragEnter: (e: ReactDragEvent) => void;
  handleContainerDragLeave: (e: ReactDragEvent) => void;
  handleContainerDragOver: (e: ReactDragEvent) => void;
  handleContainerDrop: (e: ReactDragEvent) => void;
  clearUploadStatuses: () => void;
}

export function useFileUpload(
  apiBaseUrl: string,
  threadId: string | null | undefined,
  refreshTreePreservingState: () => Promise<void>,
): UseFileUploadReturn {
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragDepthRef = useRef(0);
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);

  const { showToast } = useToast();
  const { showConfirm } = useConfirm();

  // ── Upload files (flat) ──────────────────────────────────
  const uploadFiles = useCallback(async (files: FileList, targetPath: string) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const fileNames = fileArray.map(f => f.name);
    const displayPath = targetPath || "根目录";
    const fileListPreview = fileNames.length > 3
      ? `${fileNames.slice(0, 3).join(", ")} 等 ${fileNames.length} 个文件`
      : fileNames.join(", ");

    const confirmed = await showConfirm({
      title: "确认上传",
      message: `将上传 ${fileListPreview} 到 "${displayPath}"`,
      type: "info",
      confirmText: "确认上传"
    });
    if (!confirmed) return;

    setUploadStatuses(prev => [
      ...prev,
      ...fileArray.map(f => ({
        fileName: f.name,
        status: "pending" as const,
        targetPath,
      }))
    ]);

    const startIndex = uploadStatuses.length;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const statusIndex = startIndex + i;

      setUploadStatuses(prev => prev.map((s, idx) =>
        idx === statusIndex ? { ...s, status: "uploading" } : s
      ));

      try {
        const formData = new FormData();
        formData.append("file", file);

        const url = targetPath
          ? `${apiBaseUrl}/workspace/upload?path=${encodeURIComponent(targetPath)}${threadId ? `&thread_id=${threadId}` : ""}`
          : `${apiBaseUrl}/workspace/upload${threadId ? `?thread_id=${threadId}` : ""}`;

        const response = await fetch(url, {
          method: "POST",
          body: formData,
        });

        await response
          .json()
          .catch(() => ({}) as WorkspaceUploadResponseContract);
        const isSuccess = response.ok;

        setUploadStatuses(prev => prev.map((s, idx) =>
          idx === statusIndex
            ? { ...s, status: isSuccess ? "success" : "error" }
            : s
        ));

        if (isSuccess) successCount++;
        else errorCount++;
      } catch {
        setUploadStatuses(prev => prev.map((s, idx) =>
          idx === statusIndex ? { ...s, status: "error" } : s
        ));
        errorCount++;
      }
    }

    if (errorCount === 0) {
      showToast("success", `成功上传 ${successCount} 个文件`);
    } else if (successCount === 0) {
      showToast("error", `上传失败，${errorCount} 个文件上传出错`);
    } else {
      showToast("info", `上传完成：${successCount} 成功，${errorCount} 失败`);
    }

    if (successCount > 0) {
      await refreshTreePreservingState();
    }

    setTimeout(() => {
      setUploadStatuses(prev => prev.filter(s => s.status !== "success"));
    }, 8000);
  }, [apiBaseUrl, threadId, uploadStatuses.length, showToast, showConfirm, refreshTreePreservingState]);

  // ── Upload a single file with relative path ──────────────
  const uploadSingleFile = useCallback(async (file: File, relativePath: string, targetPath: string): Promise<boolean> => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const fileDir = relativePath.includes('/')
        ? relativePath.substring(0, relativePath.lastIndexOf('/'))
        : '';
      const uploadPath = targetPath
        ? (fileDir ? `${targetPath}/${fileDir}` : targetPath)
        : fileDir;

      const url = uploadPath
        ? `${apiBaseUrl}/workspace/upload?path=${encodeURIComponent(uploadPath)}${threadId ? `&thread_id=${threadId}` : ""}`
        : `${apiBaseUrl}/workspace/upload${threadId ? `?thread_id=${threadId}` : ""}`;

      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      return response.ok;
    } catch {
      return false;
    }
  }, [apiBaseUrl, threadId]);

  // ── Read FileSystemEntry recursively ─────────────────────
  const readEntriesRecursively = useCallback(async (entry: FileSystemEntry, basePath: string = ""): Promise<{file: File, relativePath: string}[]> => {
    const results: {file: File, relativePath: string}[] = [];

    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
      results.push({ file, relativePath: basePath ? `${basePath}/${entry.name}` : entry.name });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const dirReader = dirEntry.createReader();
      const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        dirReader.readEntries(resolve, reject);
      });

      const newBasePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      for (const childEntry of entries) {
        // eslint-disable-next-line react-hooks/immutability -- recursive traversal requires self-reference
        const childResults = await readEntriesRecursively(childEntry, newBasePath);
        results.push(...childResults);
      }
    }

    return results;
  }, []);

  // ── Upload from DataTransfer (supports folders) ──────────
  const uploadFromDataTransfer = useCallback(async (dataTransfer: DataTransfer, targetPath: string) => {
    const items = dataTransfer.items;
    const allFiles: {file: File, relativePath: string}[] = [];
    const folderNames: string[] = [];

    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          entries.push(entry);
          if (entry.isDirectory) {
            folderNames.push(entry.name);
          }
        }
      }
    }

    if (entries.length === 0) {
      const files = dataTransfer.files;
      if (files && files.length > 0) {
        uploadFiles(files, targetPath);
      }
      return;
    }

    for (const entry of entries) {
      const files = await readEntriesRecursively(entry);
      allFiles.push(...files);
    }

    if (allFiles.length === 0) return;

    const displayPath = targetPath || "根目录";
    const hasFolder = folderNames.length > 0;
    const message = hasFolder
      ? `将上传 ${folderNames.length} 个文件夹（共 ${allFiles.length} 个文件）到 "${displayPath}"`
      : `将上传 ${allFiles.length} 个文件到 "${displayPath}"`;

    const confirmed = await showConfirm({
      title: "确认上传",
      message,
      type: "info",
      confirmText: "确认上传"
    });
    if (!confirmed) return;

    setUploadStatuses(prev => [
      ...prev,
      ...allFiles.map(f => ({
        fileName: f.relativePath,
        status: "pending" as const,
        targetPath,
      }))
    ]);

    const startIndex = uploadStatuses.length;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < allFiles.length; i++) {
      const { file, relativePath } = allFiles[i];
      const statusIndex = startIndex + i;

      setUploadStatuses(prev => prev.map((s, idx) =>
        idx === statusIndex ? { ...s, status: "uploading" } : s
      ));

      const success = await uploadSingleFile(file, relativePath, targetPath);

      setUploadStatuses(prev => prev.map((s, idx) =>
        idx === statusIndex
          ? { ...s, status: success ? "success" : "error" }
          : s
      ));

      if (success) successCount++;
      else errorCount++;
    }

    if (errorCount === 0) {
      showToast("success", `成功上传 ${successCount} 个文件`);
    } else if (successCount === 0) {
      showToast("error", `上传失败，${errorCount} 个文件上传出错`);
    } else {
      showToast("info", `上传完成：${successCount} 成功，${errorCount} 失败`);
    }

    if (successCount > 0) {
      await refreshTreePreservingState();
    }

    setTimeout(() => {
      setUploadStatuses(prev => prev.filter(s => s.status !== "success"));
    }, 8000);
  }, [uploadFiles, uploadSingleFile, readEntriesRecursively, uploadStatuses.length, showConfirm, showToast, refreshTreePreservingState]);

  // ── Drag handlers ────────────────────────────────────────
  const handleContainerDragEnter = useCallback((e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDraggingOver(true);
  }, []);

  const handleContainerDragLeave = useCallback((e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDraggingOver(false);
      setDragOverPath(null);
    }
  }, []);

  const handleContainerDragOver = useCallback((e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const folderElement = target.closest('[data-folder-path]');
    if (folderElement) {
      const folderPath = folderElement.getAttribute('data-folder-path');
      if (folderPath !== null) {
        setDragOverPath(folderPath);
      }
    } else {
      setDragOverPath(null);
    }
  }, []);

  const handleContainerDrop = useCallback((e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingOver(false);

    const target = e.target as HTMLElement;
    const folderElement = target.closest('[data-folder-path]');
    const targetPath = folderElement?.getAttribute('data-folder-path') || "";
    setDragOverPath(null);

    if (e.dataTransfer) {
      uploadFromDataTransfer(e.dataTransfer, targetPath);
    }
  }, [uploadFromDataTransfer]);

  const clearUploadStatuses = useCallback(() => {
    setUploadStatuses([]);
  }, []);

  return {
    uploadStatuses,
    isDraggingOver,
    dragOverPath,
    handleContainerDragEnter,
    handleContainerDragLeave,
    handleContainerDragOver,
    handleContainerDrop,
    clearUploadStatuses,
  };
}
