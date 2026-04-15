"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type {
  WorkspaceErrorResponseContract,
  WorkspaceReadResponseContract,
} from "@/lib/workspace/contracts";

export interface FileContent {
  path: string;
  content: string;
  status: "loading" | "success" | "error";
  error?: string;
}

export interface UseFileContentReturn {
  fileContent: FileContent | null;
  refetch: () => void;
}

// Cache for file contents to avoid refetching
const fileCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export function useFileContent(
  filePath: string | null,
  apiBaseUrl = "/api",
  threadId?: string | null,
): UseFileContentReturn {
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchFileContent = useCallback(async (path: string) => {
    // Abort any in-flight request so its stale callback can't overwrite state
    abortRef.current?.abort();

    // Check cache first
    const cached = fileCache.get(path);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setFileContent({
        path,
        content: cached.content,
        status: "success",
      });
      return;
    }

    setFileContent({
      path,
      content: "",
      status: "loading",
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(
        `${apiBaseUrl}/workspace/read?path=${encodeURIComponent(path)}${threadId ? `&thread_id=${threadId}` : ""}`,
        { signal: controller.signal },
      );
      const data = (await response.json()) as WorkspaceReadResponseContract;

      // If this request was aborted while parsing JSON, bail out
      if (controller.signal.aborted) return;

      if (response.ok && data.content !== undefined) {
        const content = data.content || "";
        fileCache.set(path, { content, timestamp: Date.now() });
        setFileContent({
          path,
          content,
          status: "success",
        });
      } else {
        const errorResponse = data as WorkspaceErrorResponseContract;
        setFileContent({
          path,
          content: "",
          status: "error",
          error: errorResponse.detail || "Failed to load file",
        });
      }
    } catch (err) {
      // Ignore abort errors — they're intentional
      if (err instanceof DOMException && err.name === "AbortError") return;
      setFileContent({
        path,
        content: "",
        status: "error",
        error: err instanceof Error ? err.message : "Failed to load file",
      });
    }
  }, [apiBaseUrl, threadId]);

  /* eslint-disable react-hooks/set-state-in-effect -- fetch triggers setState, reset is intentional */
  useEffect(() => {
    if (filePath) {
      fetchFileContent(filePath);
    } else {
      abortRef.current?.abort();
      setFileContent(null);
    }
  }, [filePath, fetchFileContent]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const refetch = useCallback(() => {
    if (filePath) {
      fetchFileContent(filePath);
    }
  }, [filePath, fetchFileContent]);

  return { fileContent, refetch };
}
