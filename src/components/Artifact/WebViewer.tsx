"use client";

interface WebViewerProps {
  html?: string;
  url?: string;
  className?: string;
  viewMode: "preview" | "code";
  isDark?: boolean;
}

export function WebViewer({ html, url, className = "", viewMode, isDark = false }: WebViewerProps) {
  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      <div className="flex-1 overflow-hidden">
        {viewMode === "preview" ? (
          <div className="h-full flex justify-center bg-white overflow-hidden">
            {url ? (
              <iframe
                src={url}
                className="w-full h-full border-0"
                title="Web Preview"
                sandbox="allow-scripts allow-same-origin allow-forms"
                referrerPolicy="no-referrer"
              />
            ) : html ? (
              <iframe
                srcDoc={html}
                className="w-full h-full border-0"
                title="HTML Preview"
                sandbox="allow-scripts"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                暂无内容可预览
              </div>
            )}
          </div>
        ) : (
          <div className={`h-full overflow-auto p-4 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <pre className={`text-sm whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <code>{html || "暂无代码"}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
