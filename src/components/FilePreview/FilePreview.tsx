"use client";

import { memo, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { useFileContent } from "./hooks";
import { getFileType, isUnsupportedPreviewError } from "./utils";
import { FileHeader } from "./FileHeader";
import { FileContentViewer } from "./FileContentViewer";
import { FilePreviewDialog } from "./FilePreviewDialog";

interface FilePreviewProps {
  filePath: string | null;
  apiBaseUrl?: string;
  className?: string;
  threadId?: string | null;
}

export const FilePreview = memo(function FilePreview({
  filePath,
  apiBaseUrl = "/api",
  className = "",
  threadId,
}: FilePreviewProps) {
  const { fileContent, refetch } = useFileContent(filePath, apiBaseUrl, threadId);
  const [isDark, setIsDark] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleTheme = useCallback(() => setIsDark(prev => !prev), []);
  const handleViewModeChange = useCallback((mode: "preview" | "code") => setViewMode(mode), []);
  const openFullscreen = useCallback(() => setIsFullscreen(true), []);
  const closeFullscreen = useCallback(() => setIsFullscreen(false), []);

  if (!filePath) {
    return (
      <div className={`h-full flex flex-col items-center justify-center bg-[radial-gradient(120%_120%_at_50%_-10%,#eef2ff_0%,#f7f8fc_58%,#f5f7fb_100%)] ${className}`}>
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/80 shadow-[0_6px_20px_-8px_rgba(79,70,229,0.2)] border border-indigo-100/50 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-slate-700 mb-1">选择文件预览</h3>
          <p className="text-xs text-slate-500">点击左侧文件树中的文件查看内容</p>
        </div>
      </div>
    );
  }

  // Loading state: no content yet, fetch in progress, or stale content from previous path
  if (!fileContent || fileContent.status === "loading" || fileContent.path !== filePath) {
    return (
      <div className={`h-full flex flex-col bg-[radial-gradient(120%_120%_at_50%_-10%,#eef2ff_0%,#f7f8fc_58%,#f5f7fb_100%)] ${className}`}>
        <FileHeader path={filePath} />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner className="w-6 h-6" />
        </div>
      </div>
    );
  }

  if (fileContent.status === "error") {
    const unsupported = isUnsupportedPreviewError(fileContent.error);

    return (
      <div className={`h-full flex flex-col bg-[radial-gradient(120%_120%_at_50%_-10%,#eef2ff_0%,#f7f8fc_58%,#f5f7fb_100%)] ${className}`}>
        <FileHeader path={filePath} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-4">
            <div
              className={`w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center shadow-sm ${
                unsupported ? "bg-amber-50/80 border border-amber-200/50" : "bg-red-50/80 border border-red-200/50"
              }`}
            >
              <svg
                className={`w-6 h-6 ${unsupported ? "text-amber-500" : "text-red-500"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            {unsupported ? (
              <p className="text-sm text-slate-600">该文件类型暂不支持预览</p>
            ) : (
              <>
                <p className="text-sm text-red-600">{fileContent.error}</p>
                <button
                  onClick={refetch}
                  className="mt-2 text-xs text-indigo-500 hover:underline"
                >
                  重试
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const content = fileContent.content || "";
  const fileType = getFileType(filePath, content);
  const filename = filePath.split("/").pop() || filePath;

  return (
    <div className={`h-full flex flex-col bg-[radial-gradient(120%_120%_at_50%_-10%,#eef2ff_0%,#f7f8fc_58%,#f5f7fb_100%)] ${className}`}>
      <FileHeader path={filePath} size={content.length} fileType={fileType} content={content} isDark={isDark} onToggleTheme={toggleTheme} viewMode={viewMode} onViewModeChange={handleViewModeChange} onFullscreen={openFullscreen} />
      <div className="flex-1 overflow-hidden">
        <FileContentViewer
          content={content}
          filePath={filePath}
          fileType={fileType}
          filename={filename}
          isDark={isDark}
          viewMode={viewMode}
        />
      </div>

      <AnimatePresence>
        {isFullscreen && (
          <FilePreviewDialog
            filePath={filePath}
            content={content}
            fileType={fileType}
            filename={filename}
            isDark={isDark}
            onToggleTheme={toggleTheme}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            onClose={closeFullscreen}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

function LoadingSpinner({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className} text-indigo-500`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
