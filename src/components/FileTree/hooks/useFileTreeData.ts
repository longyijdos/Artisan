"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { WorkspaceFilesResponseContract } from "@/lib/workspace/contracts";
import type { FileItem, TreeNode } from "../types";
import { toTreeNodes, getExpandedPaths } from "../utils";

export interface UseFileTreeDataReturn {
  tree: TreeNode[];
  setTree: React.Dispatch<React.SetStateAction<TreeNode[]>>;
  loading: boolean;
  error: string | null;
  fetchFiles: (path?: string) => Promise<FileItem[]>;
  refreshTreePreservingState: () => Promise<void>;
  toggleDirectory: (node: TreeNode, path: number[]) => Promise<void>;
}

export function useFileTreeData(
  apiBaseUrl: string,
  threadId: string | null | undefined,
  visible: boolean,
  onFileSelect?: (path: string | null) => void,
): UseFileTreeDataReturn {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const treeRef = useRef<TreeNode[]>([]);
  const refreshRunIdRef = useRef(0);
  const cleanupTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

  const clearCleanupTimers = useCallback(() => {
    cleanupTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    cleanupTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      refreshRunIdRef.current += 1;
      clearCleanupTimers();
    };
  }, [clearCleanupTimers]);

  const updateTreeNodeByPath = useCallback(
    (
      nodes: TreeNode[],
      targetPath: string,
      updater: (node: TreeNode) => TreeNode,
    ): TreeNode[] => {
      let changed = false;

      const nextNodes = nodes.map((node) => {
        if (node.path === targetPath) {
          changed = true;
          return updater(node);
        }

        if (!node.children || node.children.length === 0) {
          return node;
        }

        const nextChildren = updateTreeNodeByPath(node.children, targetPath, updater);
        if (nextChildren !== node.children) {
          changed = true;
          return { ...node, children: nextChildren };
        }

        return node;
      });

      return changed ? nextNodes : nodes;
    },
    [],
  );

  // ── Fetch files from API (with retry) ───────────────────
  const fetchFiles = useCallback(
    async (path: string = "", retries: number = 2): Promise<FileItem[]> => {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const response = await fetch(
            `${apiBaseUrl}/workspace/files?path=${encodeURIComponent(path)}${threadId ? `&thread_id=${threadId}` : ""}`
          );
          if (!response.ok) {
            // 4xx errors are not retryable
            if (response.status >= 400 && response.status < 500) {
              const error = new Error(`Failed to fetch files: ${response.statusText}`) as Error & { retryable?: boolean };
              error.retryable = false;
              throw error;
            }
            throw new Error(`Server error (${response.status}): ${response.statusText}`);
          }
          const data = (await response.json()) as WorkspaceFilesResponseContract;
          return data;
        } catch (err) {
          const normalizedError =
            err instanceof Error ? err : new Error("Failed to fetch files");
          lastError = normalizedError;
          const isRetryable =
            (normalizedError as Error & { retryable?: boolean }).retryable !== false;
          if (!isRetryable) {
            break;
          }
          if (attempt < retries) {
            // Exponential back-off: 500ms, 1500ms
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          }
        }
      }
      console.error("Error fetching files after retries:", lastError);
      throw lastError ?? new Error("Failed to fetch files");
    },
    [apiBaseUrl, threadId]
  );

  // ── Merge trees with animation states ────────────────────
  const mergeTreesWithAnimation = useCallback((oldNodes: TreeNode[], newNodes: TreeNode[]): TreeNode[] => {
    const oldMap = new Map(oldNodes.map(n => [n.path, n]));
    const newMap = new Map(newNodes.map(n => [n.path, n]));

    const result: TreeNode[] = [];

    for (const oldNode of oldNodes) {
      if (newMap.has(oldNode.path)) {
        const newNode = newMap.get(oldNode.path)!;
        result.push({
          ...newNode,
          isExpanded: oldNode.isExpanded,
          isNew: false,
          isRemoving: false,
          children: oldNode.isExpanded && oldNode.children && newNode.children
            ? mergeTreesWithAnimation(oldNode.children, newNode.children)
            : oldNode.children,
        });
      } else {
        result.push({
          ...oldNode,
          isRemoving: true,
        });
      }
    }

    for (const newNode of newNodes) {
      if (!oldMap.has(newNode.path)) {
        let insertIndex = result.length;
        for (let i = 0; i < result.length; i++) {
          const current = result[i];
          if (current.isRemoving) continue;
          if (newNode.isDir && !current.isDir) {
            insertIndex = i;
            break;
          }
          if (!newNode.isDir && current.isDir) {
            continue;
          }
          if (newNode.name.localeCompare(current.name) < 0) {
            insertIndex = i;
            break;
          }
        }
        result.splice(insertIndex, 0, {
          ...newNode,
          isNew: true,
          isRemoving: false,
        });
      }
    }

    return result;
  }, []);

  // ── Refresh tree while preserving expanded state ─────────
  const refreshTreePreservingState = useCallback(async () => {
    clearCleanupTimers();
    const refreshRunId = refreshRunIdRef.current + 1;
    refreshRunIdRef.current = refreshRunId;

    const expandedPaths = getExpandedPaths(treeRef.current);
    const rootFiles = await fetchFiles("");
    if (refreshRunIdRef.current !== refreshRunId) return;
    let newTree = toTreeNodes(rootFiles, "");

    const restoreExpanded = async (nodes: TreeNode[]): Promise<TreeNode[]> => {
      const result: TreeNode[] = [];
      for (const node of nodes) {
        if (node.isDir && expandedPaths.has(node.path)) {
          try {
            const childFiles = await fetchFiles(node.path);
            const children = toTreeNodes(childFiles, node.path);
            const expandedChildren = await restoreExpanded(children);
            result.push({
              ...node,
              isExpanded: true,
              children: expandedChildren,
            });
          } catch {
            result.push(node);
          }
        } else {
          result.push(node);
        }
      }
      return result;
    };

    newTree = await restoreExpanded(newTree);
    if (refreshRunIdRef.current !== refreshRunId) return;

    setTree(prev => {
      if (refreshRunIdRef.current !== refreshRunId) return prev;
      const merged = mergeTreesWithAnimation(prev, newTree);

      const removeTimer = setTimeout(() => {
        setTree(current => {
          if (refreshRunIdRef.current !== refreshRunId) return current;
          const removeMarked = (nodes: TreeNode[]): TreeNode[] => {
            return nodes
              .filter(n => !n.isRemoving)
              .map(n => ({
                ...n,
                isNew: false,
                children: n.children ? removeMarked(n.children) : undefined,
              }));
          };
          return removeMarked(current);
        });
      }, 200);

      const clearNewTimer = setTimeout(() => {
        setTree(current => {
          if (refreshRunIdRef.current !== refreshRunId) return current;
          const clearNew = (nodes: TreeNode[]): TreeNode[] => {
            return nodes.map(n => ({
              ...n,
              isNew: false,
              children: n.children ? clearNew(n.children) : undefined,
            }));
          };
          return clearNew(current);
        });
      }, 300);

      cleanupTimersRef.current = [removeTimer, clearNewTimer];

      return merged;
    });
  }, [clearCleanupTimers, fetchFiles, mergeTreesWithAnimation]);

  // ── Initial load ─────────────────────────────────────────
  useEffect(() => {
    refreshRunIdRef.current += 1;
    clearCleanupTimers();

    if (!threadId) return;

    const loadInitialTree = async () => {
      setLoading(true);
      setError(null);
      try {
        const files = await fetchFiles("");
        const newTree = toTreeNodes(files, "");
        setTree(newTree);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load files");
      } finally {
        setLoading(false);
      }
    };

    loadInitialTree();
  }, [clearCleanupTimers, threadId, fetchFiles]);

  // ── Polling — only when visible and tab is active ────────
  useEffect(() => {
    if (!threadId || !visible) return;

    const pollIntervalMs = 5000;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let inFlight = false;

    const clearPollingTimer = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    const scheduleNextPoll = (delayMs: number) => {
      if (disposed || document.hidden) return;
      clearPollingTimer();
      timeout = setTimeout(async () => {
        if (disposed || document.hidden || inFlight) return;
        inFlight = true;
        const startedAt = Date.now();
        try {
          await refreshTreePreservingState();
        } catch (err) {
          console.error("Polling error:", err);
        } finally {
          inFlight = false;
          const elapsed = Date.now() - startedAt;
          scheduleNextPoll(Math.max(0, pollIntervalMs - elapsed));
        }
      }, delayMs);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        clearPollingTimer();
        return;
      }
      // When tab becomes active again, refresh once immediately then resume interval.
      scheduleNextPoll(0);
    };

    if (!document.hidden) {
      // Initial load already fetches once; polling starts after a fixed delay.
      scheduleNextPoll(pollIntervalMs);
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      disposed = true;
      clearPollingTimer();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [threadId, visible, refreshTreePreservingState]);

  // ── Toggle directory expansion ───────────────────────────
  const toggleDirectory = useCallback(async (node: TreeNode, path: number[]) => {
    void path;
    if (!node.isDir) {
      onFileSelect?.(node.path);
      return;
    }

    onFileSelect?.(null);

    if (!node.isExpanded) {
      setTree((prev) =>
        updateTreeNodeByPath(prev, node.path, (currentNode) => ({
          ...currentNode,
          isLoading: true,
        })),
      );

      try {
        const files = await fetchFiles(node.path);
        const children = toTreeNodes(files, node.path);
        setTree((prev) =>
          updateTreeNodeByPath(prev, node.path, (currentNode) => ({
            ...currentNode,
            children,
            isExpanded: true,
            isLoading: false,
          })),
        );
      } catch {
        setTree((prev) =>
          updateTreeNodeByPath(prev, node.path, (currentNode) => ({
            ...currentNode,
            isLoading: false,
          })),
        );
      }
    } else {
      setTree((prev) =>
        updateTreeNodeByPath(prev, node.path, (currentNode) => ({
          ...currentNode,
          isExpanded: false,
        })),
      );
    }
  }, [fetchFiles, onFileSelect, updateTreeNodeByPath]);

  return {
    tree,
    setTree,
    loading,
    error,
    fetchFiles,
    refreshTreePreservingState,
    toggleDirectory,
  };
}
