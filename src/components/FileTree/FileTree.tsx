"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

import type { FileTreeProps, TreeNode } from "./types";
import { formatSize } from "./utils";
import { LoadingSpinner, ChevronRightIcon, FolderIcon, FileIcon, NewFolderIcon } from "./icons";
import { ContextMenu } from "./ContextMenu";
import { UploadStatusList } from "./UploadStatusList";
import { useFileTreeData, useFileUpload, useContextMenu } from "./hooks";

export const FileTree = memo(function FileTree({
  apiBaseUrl = "/api",
  onFileSelect,
  selectedPath: externalSelectedPath,
  className = "",
  threadId,
  visible = true,
}: FileTreeProps) {
  const [internalSelectedPath, setInternalSelectedPath] = useState<string | null>(null);

  // Sync internal state when external state changes
  useEffect(() => {
    if (externalSelectedPath !== undefined) {
      setInternalSelectedPath(externalSelectedPath);
    }
  }, [externalSelectedPath]);

  const selectedPath = externalSelectedPath ?? internalSelectedPath;

  // ── Hooks ────────────────────────────────────────────────
  const {
    tree,
    setTree,
    loading,
    error,
    fetchFiles,
    refreshTreePreservingState,
    toggleDirectory: rawToggleDirectory,
  } = useFileTreeData(apiBaseUrl, threadId, visible, (path) => {
    setInternalSelectedPath(path);
    onFileSelect?.(path);
  });

  const {
    uploadStatuses,
    isDraggingOver,
    dragOverPath,
    handleContainerDragEnter,
    handleContainerDragLeave,
    handleContainerDragOver,
    handleContainerDrop,
    clearUploadStatuses,
  } = useFileUpload(apiBaseUrl, threadId, refreshTreePreservingState);

  const {
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
  } = useContextMenu(apiBaseUrl, threadId, tree, setTree, fetchFiles, refreshTreePreservingState);

  // Wrap toggleDirectory to also update internal selection
  const toggleDirectory = useCallback(async (node: TreeNode, path: number[]) => {
    if (!node.isDir) {
      setInternalSelectedPath(node.path);
    } else {
      setInternalSelectedPath(null);
    }
    await rawToggleDirectory(node, path);
  }, [rawToggleDirectory]);

  // ── Render node ──────────────────────────────────────────
  const renderNode = useCallback((node: TreeNode, path: number[], depth: number = 0) => {
    const isSelected = selectedPath === node.path;
    const isDragTarget = dragOverPath === node.path && node.isDir;
    const isRenaming = renameNode?.path === node.path;
    const isCreatingFolderHere = newFolderParent === node.path && node.isDir;
    const isContextMenuTarget = contextMenu.visible && contextMenu.node?.path === node.path;

    let bgClass = "hover:bg-indigo-50/60 text-slate-700";
    if (isDragTarget) {
      bgClass = "bg-indigo-100/70 ring-2 ring-indigo-400/60 ring-inset text-indigo-700 shadow-sm";
    } else if (isSelected) {
      bgClass = "bg-white/80 text-indigo-600 font-medium shadow-[0_1px_6px_-4px_rgba(79,70,229,0.25)] ring-1 ring-indigo-100/50";
    } else if (isContextMenuTarget) {
      bgClass = "bg-indigo-50/60 text-slate-700";
    }

    return (
      <div key={node.path}>
        <div
          data-file-node
          className={`group flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-xl mx-1 my-0.5 transition-all duration-200 select-none ${bgClass}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => !isRenaming && toggleDirectory(node, path)}
          onContextMenu={(e) => handleContextMenu(e, node)}
          data-folder-path={node.isDir ? node.path : undefined}
        >
          {node.isDir ? (
            <>
              <span className="text-xs text-slate-400 w-4 grid place-items-center">
                <span
                  className="inline-block transition-transform duration-200"
                  style={{ transform: node.isExpanded || node.isLoading ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                  <ChevronRightIcon />
                </span>
              </span>
              <FolderIcon isOpen={node.isExpanded || node.isLoading} />
            </>
          ) : (
            <>
              <span className="w-4" />
              <FileIcon filename={node.name} />
            </>
          )}
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") handleCancelRename();
              }}
              onBlur={handleRename}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 select-text text-sm bg-white/90 border border-indigo-200/60 rounded-lg px-2 py-0.5 outline-none focus:ring-1 focus:ring-indigo-400/50 shadow-sm"
            />
          ) : (
            <span className="text-sm truncate flex-1">{node.name}</span>
          )}
          {!node.isDir && !isRenaming && (
            <span className="text-xs text-slate-400">
              {formatSize(node.size)}
            </span>
          )}
        </div>
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-in-out"
          style={{ gridTemplateRows: node.isDir && node.isExpanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            {node.isDir && node.children && (
              <>
                {isCreatingFolderHere && (
                  <div
                    className="flex items-center gap-1 px-2 py-1 mx-1 my-0.5 bg-indigo-50/60 rounded-xl"
                    style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
                  >
                    <NewFolderIcon className="w-4 h-4 text-indigo-500" />
                    <input
                      ref={newFolderInputRef}
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateFolder();
                        else if (e.key === "Escape") handleCancelNewFolder();
                      }}
                      onBlur={handleCreateFolder}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 select-text text-sm px-2 py-0.5 bg-white/90 border border-indigo-200/60 rounded-lg outline-none focus:ring-1 focus:ring-indigo-400/50 shadow-sm"
                      placeholder="新建文件夹"
                    />
                  </div>
                )}
                {node.children.map((child, i) =>
                  // eslint-disable-next-line react-hooks/immutability -- recursive render requires self-reference
                  renderNode(child, [...path, i], depth + 1)
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }, [selectedPath, toggleDirectory, dragOverPath, renameNode, renameValue, handleContextMenu, handleRename, handleCancelRename, newFolderParent, newFolderName, handleCreateFolder, handleCancelNewFolder, contextMenu, renameInputRef, setRenameValue, newFolderInputRef, setNewFolderName]);

  // ── Loading / Error states ───────────────────────────────
  if (loading && tree.length === 0) {
    return (
      <div className={`p-4 text-center ${className}`}>
        <LoadingSpinner className="w-6 h-6 mx-auto mb-2" />
        <p className="text-sm text-slate-400">加载文件...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 text-center ${className}`}>
        <p className="text-sm text-red-500 mb-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-indigo-500 hover:underline"
        >
          重试
        </button>
      </div>
    );
  }

  const isRootDragTarget = isDraggingOver && !dragOverPath;

  return (
    <div
      className={`py-2 h-full flex flex-col relative select-none [-webkit-user-select:none] [-webkit-touch-callout:none] ${className}`}
      onDragEnter={handleContainerDragEnter}
      onDragLeave={handleContainerDragLeave}
      onDragOver={handleContainerDragOver}
      onDrop={handleContainerDrop}
      onContextMenu={handleContainerContextMenu}
    >
      {/* File Tree */}
      <div className={`flex-1 relative ${isRootDragTarget ? "bg-indigo-50/40 ring-2 ring-inset ring-indigo-400/50" : ""}`}>
        <AnimatePresence>
          {isContextRefreshing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="pointer-events-none absolute inset-0 z-20"
            >
              <div className="absolute inset-0 bg-indigo-50/15" />
              <div className="absolute right-2 top-2 rounded-full border border-indigo-200/50 bg-white/90 px-2 py-0.5 text-[11px] text-indigo-600 shadow-sm backdrop-blur-sm">
                刷新中...
              </div>
              <div className="absolute left-0 right-0 top-0 h-[2px] overflow-hidden bg-indigo-100/60">
                <motion.span
                  className="block h-full w-1/3 rounded-full bg-indigo-400/75"
                  animate={{ x: ["-120%", "320%"] }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* New folder input at root level */}
        {newFolderParent === "" && (
          <div className="flex items-center gap-1 px-2 py-1 mx-1 my-0.5 bg-indigo-50/60 rounded-xl">
            <NewFolderIcon className="w-4 h-4 text-indigo-500" />
            <input
              ref={newFolderInputRef}
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                else if (e.key === "Escape") handleCancelNewFolder();
              }}
              onBlur={handleCreateFolder}
              className="flex-1 select-text text-sm px-2 py-0.5 bg-white/90 border border-indigo-200/60 rounded-lg outline-none focus:ring-1 focus:ring-indigo-400/50 shadow-sm"
              placeholder="新建文件夹"
            />
          </div>
        )}
        {tree.length === 0 && newFolderParent !== "" ? (
          <p className="text-sm text-slate-400 text-center py-4">
            文件夹为空
          </p>
        ) : (
          tree.map((node, i) => renderNode(node, [i], 0))
        )}
      </div>

      {/* Upload Status */}
      <UploadStatusList statuses={uploadStatuses} onClear={clearUploadStatuses} />

      {/* Context Menu */}
      <ContextMenu
        contextMenu={contextMenu}
        onStartNewFolder={handleStartNewFolder}
        onDownload={handleDownload}
        onStartRename={handleStartRename}
        onDelete={handleDelete}
        onRefresh={handleRefreshFromContextMenu}
        onClose={closeContextMenu}
        onIndexKnowledge={handleIndexKnowledge}
      />
    </div>
  );
});
