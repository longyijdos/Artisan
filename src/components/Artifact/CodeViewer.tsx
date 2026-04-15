"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

interface CodeViewerProps {
  code: string;
  language: string;
  filename?: string;
  className?: string;
  isDark: boolean;
}

export function CodeViewer({
  code,
  language,
  className = "",
  isDark,
}: CodeViewerProps) {
  const [highlightedCode, setHighlightedCode] = useState<string>("");
  const shikiTheme = isDark ? "github-dark" : "github-light";

  useEffect(() => {
    let cancelled = false;
    async function highlight() {
      try {
        const html = await codeToHtml(code, {
          lang: language,
          theme: shikiTheme,
        });
        if (!cancelled) setHighlightedCode(html);
      } catch {
        if (!cancelled) setHighlightedCode(`<pre><code>${escapeHtml(code)}</code></pre>`);
      }
    }
    highlight();
    return () => { cancelled = true; };
  }, [code, language, shikiTheme]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className={`flex-1 overflow-auto p-4 transition-colors ${
        isDark ? 'bg-slate-900' : 'bg-white'
      }`}>
        {highlightedCode ? (
          <div
            className="text-sm [&_pre]:!bg-transparent [&_pre]:!p-0 [&_code]:!bg-transparent"
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        ) : (
          <pre className={`text-sm whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
