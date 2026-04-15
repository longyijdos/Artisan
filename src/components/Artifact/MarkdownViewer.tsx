"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { codeToHtml } from "shiki";
import { useEffect, useRef } from "react";

interface MarkdownViewerProps {
  content: string;
  className?: string;
  isDark: boolean;
  viewMode: "preview" | "code";
}

/* ── Theme tokens (Tailwind classes) ─────────────────────────── */

const dark = {
  wrapper: "bg-gray-900 text-gray-300",
  h1: "text-gray-50",
  h2: "text-gray-100",
  h3: "text-gray-100",
  p: "text-gray-300",
  strong: "text-white",
  link: "text-blue-400 hover:text-blue-300",
  list: "text-gray-300",
  blockquote: "border-gray-600 text-gray-400",
  hr: "border-gray-600",
  inlineCode: "bg-gray-700 text-pink-300",
  codeBlock: "bg-slate-800 text-slate-200 border-gray-700",
  table: "border-gray-700",
  th: "bg-gray-800 border-gray-700 text-gray-200",
  td: "border-gray-700 text-gray-300",
  thead: "bg-gray-800",
};

const light = {
  wrapper: "bg-white text-gray-700",
  h1: "text-gray-900",
  h2: "text-gray-800",
  h3: "text-gray-800",
  p: "text-gray-700",
  strong: "text-gray-900",
  link: "text-blue-600 hover:text-blue-700",
  list: "text-gray-700",
  blockquote: "border-gray-300 text-gray-500",
  hr: "border-gray-300",
  inlineCode: "bg-pink-100 text-pink-600",
  codeBlock: "bg-slate-100 text-slate-700 border-slate-200",
  table: "border-slate-200",
  th: "bg-slate-50 border-slate-200 text-slate-700",
  td: "border-slate-200 text-slate-700",
  thead: "bg-slate-50",
};

type Theme = typeof dark;

/* ── Highlighted code block ──────────────────────────────────── */

function HighlightedCodeBlock({
  code,
  language,
  isDark,
  theme,
}: {
  code: string;
  language?: string;
  isDark: boolean;
  theme: Theme;
}) {
  const lang = (language || "text").toLowerCase();
  const shikiTheme = isDark ? "github-dark" : "github-light";
  const [html, setHtml] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!code.trim()) {
      setHtml(""); // eslint-disable-line react-hooks/set-state-in-effect -- sync reset before async path
      return;
    }
    let cancelled = false;
    codeToHtml(code, { lang, theme: shikiTheme })
      .then((result) => {
        if (!cancelled && mountedRef.current) setHtml(result);
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) setHtml("");
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang, shikiTheme]);

  return (
    <pre
      className={`rounded-lg p-4 my-4 overflow-x-auto text-sm ${theme.codeBlock}`}
    >
      {html ? (
        <code
          className="[&_.shiki]:!m-0 [&_.shiki]:!bg-transparent [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0 [&_code]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <code className="block whitespace-pre font-mono">{code}</code>
      )}
    </pre>
  );
}

/* ── Markdown components factory ─────────────────────────────── */

function buildComponents(theme: Theme, isDark: boolean) {
  return {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className={`text-2xl font-bold mt-6 mb-4 ${theme.h1}`}>{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className={`text-xl font-bold mt-5 mb-3 ${theme.h2}`}>{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className={`text-lg font-semibold mt-5 mb-2 ${theme.h3}`}>{children}</h3>
    ),
    h4: ({ children }: { children?: React.ReactNode }) => (
      <h4 className={`text-base font-semibold mt-4 mb-2 ${theme.h3}`}>{children}</h4>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className={`my-3 first:mt-0 last:mb-0 leading-relaxed ${theme.p}`}>{children}</p>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className={`font-semibold ${theme.strong}`}>{children}</strong>
    ),
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline underline-offset-2 ${theme.link}`}
      >
        {children}
      </a>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className={`my-3 first:mt-0 last:mb-0 list-disc pl-6 space-y-1.5 ${theme.list}`}>{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className={`my-3 first:mt-0 last:mb-0 list-decimal pl-6 space-y-1.5 ${theme.list}`}>{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="leading-relaxed">{children}</li>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className={`my-4 border-l-4 pl-4 italic ${theme.blockquote}`}>
        {children}
      </blockquote>
    ),
    hr: () => <hr className={`my-6 ${theme.hr}`} />,
    code: ({
      className,
      children,
    }: {
      className?: string;
      children?: React.ReactNode;
    }) => {
      const rawText = String(children ?? "");
      const isBlock =
        Boolean(className && className.includes("language-")) ||
        rawText.includes("\n");
      const language = className?.match(/language-([\w-]+)/)?.[1];

      if (!isBlock) {
        return (
          <code className={`rounded px-1.5 py-0.5 text-[0.9em] ${theme.inlineCode}`}>
            {children}
          </code>
        );
      }

      return (
        <HighlightedCodeBlock
          code={rawText.replace(/\n$/, "")}
          language={language}
          isDark={isDark}
          theme={theme}
        />
      );
    },
    pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    table: ({ children }: { children?: React.ReactNode }) => (
      <div className="my-4 overflow-x-auto">
        <table className={`min-w-full border-collapse text-sm ${theme.table}`}>{children}</table>
      </div>
    ),
    thead: ({ children }: { children?: React.ReactNode }) => (
      <thead className={theme.thead}>{children}</thead>
    ),
    th: ({ children }: { children?: React.ReactNode }) => (
      <th className={`border px-3 py-1.5 text-left font-semibold ${theme.th}`}>{children}</th>
    ),
    td: ({ children }: { children?: React.ReactNode }) => (
      <td className={`border px-3 py-1.5 align-top ${theme.td}`}>{children}</td>
    ),
  };
}

/* ── Main component ──────────────────────────────────────────── */

export function MarkdownViewer({ content, className = "", isDark, viewMode }: MarkdownViewerProps) {
  const theme = isDark ? dark : light;
  const components = useMemo(() => buildComponents(theme, isDark), [theme, isDark]);

  const renderableContent = useMemo(() => {
    const raw = content || "";
    const fenceCount = (raw.match(/```/g) ?? []).length;
    return fenceCount % 2 === 1 ? `${raw}\n\`\`\`` : raw;
  }, [content]);

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {viewMode === "preview" ? (
        <div className={`flex-1 overflow-auto ${theme.wrapper}`}>
          <article className="max-w-none p-6">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
              components={components}
            >
              {renderableContent}
            </ReactMarkdown>
          </article>
        </div>
      ) : (
        <div className={`flex-1 overflow-auto p-4 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
          <pre className={`text-sm whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <code>{content || "暂无代码"}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
