"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import type {
  WorkspaceDeleteResponseContract,
  WorkspaceMkdirResponseContract,
  WorkspaceRenameResponseContract,
} from "@/lib/workspace/contracts";
import type {
  KnowledgeIndexResponseContract,
  KnowledgeCheckResponseContract,
} from "@/lib/knowledge/contracts";
import type { TreeNode, ContextMenuState, FileItem } from "../types";
import { toTreeNodes, findNodeByPath, expandFolderByPath } from "../utils";
import type { MouseEvent as ReactMouseEvent } from "react";

export interface UseContextMenuReturn {
  contextMenu: ContextMenuState;
  isContextRefreshing: boolean;
  renameNode: TreeNode | null;
  renameValue: string;
  setRenameValue: (value: string) => void;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  newFolderParent: string | null;
  newFolderName: string;
  setNewFolderName: (value: string) => void;
  newFolderInputRef: React.RefObject<HTMLInputElement | null>;
  handleContextMenu: (e: ReactMouseEvent, node: TreeNode) => void;
  handleContainerContextMenu: (e: ReactMouseEvent) => void;
  closeContextMenu: () => void;
  handleDelete: (node: TreeNode) => Promise<void>;
  handleDownload: (node: TreeNode) => void;
  handleStartRename: (node: TreeNode) => void;
  handleRename: () => Promise<void>;
  handleCancelRename: () => void;
  handleStartNewFolder: (parentPath: string) => Promise<void>;
  handleCreateFolder: () => Promise<void>;
  handleCancelNewFolder: () => void;
  handleRefreshFromContextMenu: () => Promise<void>;
  handleIndexKnowledge: (node: TreeNode | null) => void;
}

export function useContextMenu(
  apiBaseUrl: string,
  threadId: string | null | undefined,
  tree: TreeNode[],
  setTree: React.Dispatch<React.SetStateAction<TreeNode[]>>,
  fetchFiles: (path?: string) => Promise<FileItem[]>,
  refreshTreePreservingState: () => Promise<void>,
): UseContextMenuReturn {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  });
  const [isContextRefreshing, setIsContextRefreshing] = useState(false);
  const [renameNode, setRenameNode] = useState<TreeNode | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [newFolderParent, setNewFolderParent] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const { showToast, hideToast } = useToast();
  const { showConfirm } = useConfirm();

  // ── Context menu open/close ──────────────────────────────
  const handleContextMenu = useCallback((e: ReactMouseEvent, node: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false, node: null }));
  }, []);

  const handleContainerContextMenu = useCallback((e: ReactMouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-file-node]')) return;

    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node: null,
    });
  }, []);

  useEffect(() => {
    if (!contextMenu.visible) return;
    const handleClick = () => closeContextMenu();
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [contextMenu.visible, closeContextMenu]);

  // ── Delete ───────────────────────────────────────────────
  const handleDelete = useCallback(async (node: TreeNode) => {
    closeContextMenu();

    const title = node.isDir ? "删除文件夹" : "删除文件";
    const message = node.isDir
      ? `确定要删除文件夹 "${node.name}" 及其所有内容吗？此操作不可恢复。`
      : `确定要删除文件 "${node.name}" 吗？此操作不可恢复。`;

    const confirmed = await showConfirm({
      title,
      message,
      type: "danger",
      confirmText: "确认删除"
    });
    if (!confirmed) return;

    try {
      const response = await fetch(
        `${apiBaseUrl}/workspace/delete?path=${encodeURIComponent(node.path)}${threadId ? `&thread_id=${threadId}` : ""}`,
        { method: "DELETE" }
      );
      const result = (await response.json()) as WorkspaceDeleteResponseContract;

      if (response.ok) {
        showToast("success", `已删除 ${node.isDir ? "文件夹" : "文件"} "${node.name}"`);
        await refreshTreePreservingState();
      } else {
        showToast("error", `删除失败: ${result.detail || "未知错误"}`);
      }
    } catch (err) {
      showToast("error", `删除失败: ${err}`);
    }
  }, [apiBaseUrl, threadId, closeContextMenu, refreshTreePreservingState, showConfirm, showToast]);

  // ── Download ─────────────────────────────────────────────
  const handleDownload = useCallback((node: TreeNode) => {
    closeContextMenu();

    if (node.isDir) {
      showToast("error", "暂不支持下载文件夹");
      return;
    }

    const url = `${apiBaseUrl}/workspace/download?path=${encodeURIComponent(node.path)}${threadId ? `&thread_id=${threadId}` : ""}`;

    const link = document.createElement("a");
    link.href = url;
    link.download = node.name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("info", `开始下载 "${node.name}"`);
  }, [apiBaseUrl, threadId, closeContextMenu, showToast]);

  // ── Rename ───────────────────────────────────────────────
  const handleStartRename = useCallback((node: TreeNode) => {
    closeContextMenu();
    setRenameNode(node);
    setRenameValue(node.name);
    setTimeout(() => renameInputRef.current?.focus(), 0);
  }, [closeContextMenu]);

  const handleRename = useCallback(async () => {
    if (!renameNode || !renameValue.trim() || renameValue === renameNode.name) {
      setRenameNode(null);
      return;
    }

    const oldPath = renameNode.path;
    const oldName = renameNode.name;
    const parentPath = oldPath.includes("/") ? oldPath.substring(0, oldPath.lastIndexOf("/")) : "";
    const newPath = parentPath ? `${parentPath}/${renameValue}` : renameValue;

    try {
      const response = await fetch(
        `${apiBaseUrl}/workspace/rename?old_path=${encodeURIComponent(oldPath)}&new_path=${encodeURIComponent(newPath)}${threadId ? `&thread_id=${threadId}` : ""}`,
        { method: "POST" }
      );
      const result = (await response.json()) as WorkspaceRenameResponseContract;

      if (response.ok) {
        showToast("success", `已重命名 "${oldName}" → "${renameValue}"`);
        await refreshTreePreservingState();
      } else {
        showToast("error", `重命名失败: ${result.detail || "未知错误"}`);
      }
    } catch (err) {
      showToast("error", `重命名失败: ${err}`);
    }

    setRenameNode(null);
  }, [renameNode, renameValue, apiBaseUrl, threadId, refreshTreePreservingState, showToast]);

  const handleCancelRename = useCallback(() => {
    setRenameNode(null);
  }, []);

  // ── New folder ───────────────────────────────────────────
  const handleStartNewFolder = useCallback(async (parentPath: string) => {
    closeContextMenu();

    if (parentPath) {
      const targetNode = findNodeByPath(tree, parentPath);
      if (targetNode && targetNode.isDir && !targetNode.isExpanded) {
        try {
          const files = await fetchFiles(parentPath);
          const children = toTreeNodes(files, parentPath);

          setTree(prev => {
            const updateWithChildren = (nodes: TreeNode[]): TreeNode[] => {
              return nodes.map(node => {
                if (node.path === parentPath) {
                  return { ...node, isExpanded: true, children };
                } else if (node.children) {
                  return { ...node, children: updateWithChildren(node.children) };
                }
                return node;
              });
            };
            return updateWithChildren(prev);
          });
        } catch (err) {
          showToast("error", `无法展开文件夹: ${err}`);
          return;
        }
      } else {
        setTree(prev => expandFolderByPath(prev, parentPath));
      }
    }

    setNewFolderParent(parentPath);
    setNewFolderName("");
    setTimeout(() => newFolderInputRef.current?.focus(), 50);
  }, [closeContextMenu, tree, fetchFiles, setTree, showToast]);

  const handleCreateFolder = useCallback(async () => {
    if (newFolderParent === null || !newFolderName.trim()) {
      setNewFolderParent(null);
      return;
    }

    const folderPath = newFolderParent
      ? `${newFolderParent}/${newFolderName.trim()}`
      : newFolderName.trim();

    try {
      const response = await fetch(
        `${apiBaseUrl}/workspace/mkdir?path=${encodeURIComponent(folderPath)}${threadId ? `&thread_id=${threadId}` : ""}`,
        { method: "POST" }
      );
      const result = (await response.json()) as WorkspaceMkdirResponseContract;

      if (response.ok) {
        showToast("success", `已创建文件夹 "${newFolderName.trim()}"`);
        await refreshTreePreservingState();
      } else {
        showToast("error", `创建失败: ${result.detail || "未知错误"}`);
      }
    } catch (err) {
      showToast("error", `创建失败: ${err}`);
    }

    setNewFolderParent(null);
  }, [newFolderParent, newFolderName, apiBaseUrl, threadId, refreshTreePreservingState, showToast]);

  const handleCancelNewFolder = useCallback(() => {
    setNewFolderParent(null);
  }, []);

  // ── Refresh from context menu ────────────────────────────
  const handleRefreshFromContextMenu = useCallback(async () => {
    setIsContextRefreshing(true);
    const startedAt = performance.now();
    try {
      await refreshTreePreservingState();
    } finally {
      const elapsed = performance.now() - startedAt;
      const minVisibleMs = 220;
      const waitMs = Math.max(0, minVisibleMs - elapsed);
      if (waitMs > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, waitMs));
      }
      setIsContextRefreshing(false);
    }
  }, [refreshTreePreservingState]);

  // ── Index knowledge ─────────────────────────────────────
  const handleIndexKnowledge = useCallback(async (node: TreeNode | null) => {
    closeContextMenu();
    if (!node) return;

    if (!threadId) {
      showToast("warning", "请先选择一个会话");
      return;
    }

    const isDir = node.isDir;
    const path = node.path;
    const name = node.name;

    // Check if already indexed
    let force = false;
    try {
      const checkRes = await fetch("/api/knowledge/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, is_dir: isDir }),
      });
      const checkData = (await checkRes.json()) as KnowledgeCheckResponseContract;

      if (checkRes.ok && checkData.exists) {
        const confirmed = await showConfirm({
          title: "重复索引",
          message: `"${checkData.name || name}" 已索引过，是否重新索引？旧数据将被覆盖。`,
          type: "info",
          confirmText: "重新索引",
        });
        if (!confirmed) return;
        force = true;
      }
    } catch {
      // Check failed, proceed without force
    }

    showToast("loading", `正在索引 "${name}"...`);

    fetch("/api/knowledge/index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, is_dir: isDir, thread_id: threadId, force }),
    })
      .then(async (response) => {
        hideToast();
        const data = (await response.json()) as KnowledgeIndexResponseContract;
        if (response.ok && data.success) {
          showToast("success", data.message || `"${name}" 索引完成`);
        } else {
          showToast("error", data.detail || "索引失败");
        }
      })
      .catch((err) => {
        hideToast();
        showToast("error", `索引失败: ${err}`);
      });
  }, [closeContextMenu, threadId, showToast, hideToast, showConfirm]);

  return {
    contextMenu,
    isContextRefreshing,
    renameNode,
    renameValue,
    setRenameValue,
    renameInputRef,
    newFolderParent,
    newFolderName,
    setNewFolderName,
    newFolderInputRef,
    handleContextMenu,
    handleContainerContextMenu,
    closeContextMenu,
    handleDelete,
    handleDownload,
    handleStartRename,
    handleRename,
    handleCancelRename,
    handleStartNewFolder,
    handleCreateFolder,
    handleCancelNewFolder,
    handleRefreshFromContextMenu,
    handleIndexKnowledge,
  };
}
