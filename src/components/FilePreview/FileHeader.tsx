import { memo } from "react";
import { FileType, getLanguageFromPath } from "./utils";

export const FileHeader = memo(function FileHeader({
  path,
  fileType,
  isDark,
  onToggleTheme,
  viewMode,
  onViewModeChange,
  onFullscreen,
  onClose,
}: {
  path: string;
  size?: number;
  fileType?: FileType;
  content?: string;
  isDark?: boolean;
  onToggleTheme?: () => void;
  viewMode?: "preview" | "code";
  onViewModeChange?: (mode: "preview" | "code") => void;
  onFullscreen?: () => void;
  onClose?: () => void;
}) {
  const filename = path.split("/").pop() || path;
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  const fileTypeLabels: Record<FileType, { label: string; className: string }> = {
    html: { label: "网页预览", className: "bg-green-100 text-green-600" },
    markdown: { label: "Markdown", className: "bg-purple-100 text-purple-600" },
    slide: { label: "幻灯片", className: "bg-blue-100 text-blue-600" },
    code: { label: "代码", className: "bg-slate-100 text-slate-600" },
  };

  const typeInfo = fileType ? fileTypeLabels[fileType] : null;
  const language = fileType === "code" ? getLanguageFromPath(path) : null;
  const hasViewModeToggle = fileType === "markdown" || fileType === "html";
  const hasThemeToggle = fileType === "code" || fileType === "markdown" || fileType === "html";

  return (
    <div className="h-12 flex items-center justify-between px-4 border-b border-indigo-100/40 bg-white/70 backdrop-blur-sm flex-shrink-0">
      {/* Left: file info + view mode toggle */}
      <div className="flex items-center gap-2 min-w-0">
        <FileIcon ext={ext} />
        <span className="text-sm font-medium text-slate-700 truncate">{filename}</span>
        {typeInfo && !language && (
          <span className={`px-2 py-0.5 rounded text-xs ${typeInfo.className}`}>
            {typeInfo.label}
          </span>
        )}
        {language && (
          <span className="px-2 py-0.5 text-xs bg-indigo-50/60 text-indigo-600 rounded-full font-medium border border-indigo-100/40">
            {language}
          </span>
        )}
        {/* Preview / Code toggle for markdown & html */}
        {hasViewModeToggle && onViewModeChange && (
          <div className="flex bg-slate-200 rounded-lg p-0.5 ml-1">
            <button
              onClick={() => onViewModeChange("preview")}
              className={`px-2.5 py-0.5 text-xs rounded-md transition-colors ${
                viewMode === "preview"
                  ? "bg-white text-indigo-600 shadow-sm font-medium"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              预览
            </button>
            <button
              onClick={() => onViewModeChange("code")}
              className={`px-2.5 py-0.5 text-xs rounded-md transition-colors ${
                viewMode === "code"
                  ? "bg-white text-indigo-600 shadow-sm font-medium"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              代码
            </button>
          </div>
        )}
      </div>

      {/* Right: theme toggle + fullscreen + close */}
      <div className="flex items-center gap-2">
        {/* Theme toggle for code & markdown */}
        {hasThemeToggle && onToggleTheme && (fileType === "code" || viewMode === "code" || viewMode === "preview") && (
          <div className={`flex rounded-lg p-0.5 ${isDark ? 'bg-gray-700' : 'bg-slate-200'}`}>
            <button
              onClick={() => { if (isDark) onToggleTheme(); }}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                !isDark
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              title="浅色模式"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
            <button
              onClick={() => { if (!isDark) onToggleTheme(); }}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                isDark
                  ? "bg-gray-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              title="深色模式"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </button>
          </div>
        )}

        {/* Fullscreen button (only in normal mode, not in dialog) */}
        {onFullscreen && (
          <button
            onClick={onFullscreen}
            className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-indigo-50/60"
            title="全屏查看"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        )}

        {/* Close button (only in dialog/fullscreen mode) */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors rounded-lg hover:bg-slate-100/60"
            title="关闭"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
});

const FileIcon = memo(function FileIcon({ ext }: { ext: string }) {
  const iconColors: Record<string, string> = {
    ts: "text-blue-500",
    tsx: "text-blue-500",
    js: "text-yellow-500",
    jsx: "text-yellow-500",
    py: "text-green-500",
    json: "text-amber-500",
    md: "text-slate-500",
    css: "text-pink-500",
    html: "text-orange-500",
    svg: "text-purple-500",
    xml: "text-orange-400",
  };

  const color = iconColors[ext] || "text-slate-400";

  return (
    <svg className={`w-4 h-4 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
});
