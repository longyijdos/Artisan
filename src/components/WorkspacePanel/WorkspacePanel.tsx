"use client";

import { useState, useCallback, memo } from "react";
import { FileTree } from "@/components/FileTree";
import { FilePreview } from "@/components/FilePreview";

interface WorkspacePanelProps {
  threadId: string | null;
  visible?: boolean;
  onClose?: () => void;
}

const TREE_WIDTH = 200;

export const WorkspacePanel = memo(function WorkspacePanel({
  threadId,
  visible = true,
  onClose,
}: WorkspacePanelProps) {
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const handleFileSelect = useCallback((path: string | null) => {
    if (!path) return;
    setSelectedFilePath(path);
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((v) => !v);
  }, []);

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-white via-[#fafbff] to-[#f5f7fb]">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-indigo-100/40 bg-white/70 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">工作区</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 transition-colors"
            title="关闭面板"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Content: File Tree + File Preview */}
      <div className="flex-1 overflow-hidden flex">
        {/* File Tree */}
        <div
          className="h-full overflow-hidden bg-white/60 flex-shrink-0 transition-[width] duration-200 ease-out"
          style={{ width: collapsed ? 0 : TREE_WIDTH }}
        >
          <div className="h-full overflow-auto" style={{ width: TREE_WIDTH }}>
            <FileTree
              onFileSelect={handleFileSelect}
              selectedPath={selectedFilePath}
              threadId={threadId}
              visible={visible}
            />
          </div>
        </div>

        {/* Divider + Toggle Button */}
        <div className="h-full w-[1px] flex-shrink-0 bg-indigo-100/30 relative">
          <button
            onClick={toggleCollapse}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 z-10 w-5 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-indigo-500 hover:border-indigo-300 shadow-sm transition-colors duration-150"
            title={collapsed ? "展开文件列表" : "收起文件列表"}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>

        {/* File Preview */}
        <div className="h-full flex-1 overflow-hidden">
          <FilePreview filePath={selectedFilePath} threadId={threadId} />
        </div>
      </div>
    </div>
  );
});
