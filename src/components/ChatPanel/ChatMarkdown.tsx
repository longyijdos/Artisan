"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { codeToHtml } from "shiki";
import { useToast } from "@/components/Toast";

const HIGHLIGHT_CACHE_MAX = 240;
const HIGHLIGHT_UPDATE_INTERVAL_MS = 80;
const highlightCache = new Map<string, string>();

function setHighlightCache(cacheKey: string, html: string) {
  if (highlightCache.has(cacheKey)) {
    highlightCache.set(cacheKey, html);
    return;
  }
  if (highlightCache.size >= HIGHLIGHT_CACHE_MAX) {
    const oldestKey = highlightCache.keys().next().value;
    if (typeof oldestKey === "string") {
      highlightCache.delete(oldestKey);
    }
  }
  highlightCache.set(cacheKey, html);
}

interface ChatMarkdownProps {
  content: string;
}

interface ChatCodeBlockProps {
  code: string;
  language?: string;
}

function ChatCodeBlock({ code, language }: ChatCodeBlockProps) {
  const [highlightedCode, setHighlightedCode] = useState<string>("");
  const { showToast } = useToast();
  const lang = (language || "text").toLowerCase();
  const cacheKey = `${lang}\n${code}`;
  const latestKeyRef = useRef(cacheKey);
  const latestCodeRef = useRef(code);
  const latestLangRef = useRef(lang);
  const pendingRef = useRef(false);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const lastHighlightedAtRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    latestKeyRef.current = cacheKey;
    latestCodeRef.current = code;
    latestLangRef.current = lang;
    pendingRef.current = true;

    const processHighlight = async () => {
      if (runningRef.current) {
        return;
      }
      runningRef.current = true;

      try {
        while (pendingRef.current && mountedRef.current) {
          pendingRef.current = false;

          const targetKey = latestKeyRef.current;
          const targetCode = latestCodeRef.current;
          const targetLang = latestLangRef.current;

          const cached = highlightCache.get(targetKey);
          if (cached !== undefined) {
            if (latestKeyRef.current === targetKey) {
              setHighlightedCode((prev) => (prev === cached ? prev : cached));
            }
            continue;
          }

          if (!targetCode.trim()) {
            if (latestKeyRef.current === targetKey) {
              setHighlightedCode((prev) => (prev === "" ? prev : ""));
            }
            continue;
          }

          const elapsed = performance.now() - lastHighlightedAtRef.current;
          if (elapsed < HIGHLIGHT_UPDATE_INTERVAL_MS) {
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, HIGHLIGHT_UPDATE_INTERVAL_MS - elapsed);
            });
            if (!mountedRef.current) {
              return;
            }
          }

          try {
            const html = await codeToHtml(targetCode, {
              lang: targetLang,
              theme: "github-light",
            });
            setHighlightCache(targetKey, html);

            if (!mountedRef.current) {
              return;
            }

            if (latestKeyRef.current !== targetKey) {
              pendingRef.current = true;
              continue;
            }

            lastHighlightedAtRef.current = performance.now();
            setHighlightedCode((prev) => (prev === html ? prev : html));
          } catch {
            if (!mountedRef.current) {
              return;
            }
            if (latestKeyRef.current === targetKey) {
              setHighlightedCode((prev) => (prev === "" ? prev : ""));
            }
          }
        }
      } finally {
        runningRef.current = false;
      }
    };

    void processHighlight();

    return () => {
      // Cleanup handled by mountedRef; keep latest highlight visible between updates.
    };
  }, [cacheKey, code, lang]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      showToast("success", "代码已复制");
    } catch {
      showToast("error", "复制失败，请重试");
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-indigo-500">
          {lang}
        </span>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="px-2 py-0.5 text-[11px] font-medium text-indigo-600 transition-colors hover:text-indigo-950 hover:underline hover:decoration-2 hover:underline-offset-2"
        >
          复制
        </button>
      </div>

      <div className="overflow-x-auto bg-white p-3">
        {highlightedCode ? (
          <div
            className="text-[12px] leading-5 [&_.shiki]:!m-0 [&_.shiki]:!bg-transparent [&_code]:!bg-transparent [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0"
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        ) : (
          <pre className="m-0 overflow-x-auto">
            <code className="block whitespace-pre font-mono text-[12px] leading-5 text-slate-800">
              {code}
            </code>
          </pre>
        )}
      </div>
    </div>
  );
}

export const ChatMarkdown = memo(function ChatMarkdown({ content }: ChatMarkdownProps) {
  const renderableContent = useMemo(() => {
    const raw = content || "";
    const fenceCount = (raw.match(/```/g) ?? []).length;
    return fenceCount % 2 === 1 ? `${raw}\n\`\`\`` : raw;
  }, [content]);

  const markdownComponents = useMemo(
    () => ({
      h1: ({ children }: { children?: React.ReactNode }) => (
        <h1 className="mt-4 mb-2 text-2xl font-semibold text-slate-900">{children}</h1>
      ),
      h2: ({ children }: { children?: React.ReactNode }) => (
        <h2 className="mt-4 mb-2 text-xl font-semibold text-slate-900">{children}</h2>
      ),
      h3: ({ children }: { children?: React.ReactNode }) => (
        <h3 className="mt-3 mb-1.5 text-lg font-semibold text-slate-900">{children}</h3>
      ),
      p: ({ children }: { children?: React.ReactNode }) => (
        <p className="my-3 first:mt-0 last:mb-0 text-slate-800">{children}</p>
      ),
      a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-700 underline decoration-indigo-200 underline-offset-2 hover:text-indigo-800"
        >
          {children}
        </a>
      ),
      ul: ({ children }: { children?: React.ReactNode }) => (
        <ul className="my-3 first:mt-0 last:mb-0 list-disc pl-6 space-y-1.5 text-slate-800">{children}</ul>
      ),
      ol: ({ children }: { children?: React.ReactNode }) => (
        <ol className="my-3 first:mt-0 last:mb-0 list-decimal pl-6 space-y-1.5 text-slate-800">{children}</ol>
      ),
      li: ({ children }: { children?: React.ReactNode }) => (
        <li className="leading-relaxed">{children}</li>
      ),
      blockquote: ({ children }: { children?: React.ReactNode }) => (
        <blockquote className="my-4 border-l-2 border-indigo-200 pl-4 text-slate-600">
          {children}
        </blockquote>
      ),
      code: ({
        className,
        children,
        ...props
      }: {
        className?: string;
        children?: React.ReactNode;
      }) => {
        const rawText = String(children ?? "");
        const isBlock = Boolean(className && className.includes("language-")) || rawText.includes("\n");
        const language = className?.match(/language-([\w-]+)/)?.[1];

        if (!isBlock) {
          return (
            <code
              className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[0.9em] text-indigo-900"
              {...props}
            >
              {children}
            </code>
          );
        }

        return <ChatCodeBlock code={rawText.replace(/\n$/, "")} language={language} />;
      },
      pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      hr: () => <hr className="my-4 border-slate-200" />,
      table: ({ children }: { children?: React.ReactNode }) => (
        <div className="my-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">{children}</table>
        </div>
      ),
      thead: ({ children }: { children?: React.ReactNode }) => (
        <thead className="bg-indigo-50">{children}</thead>
      ),
      th: ({ children }: { children?: React.ReactNode }) => (
        <th className="border border-indigo-100 px-2 py-1 text-left font-semibold text-slate-700">
          {children}
        </th>
      ),
      td: ({ children }: { children?: React.ReactNode }) => (
        <td className="border border-indigo-100 px-2 py-1 align-top text-slate-700">{children}</td>
      ),
    }),
    [],
  );

  return (
    <div className="max-w-none break-words text-[15px] leading-7 text-slate-800 [overflow-wrap:anywhere] [word-break:break-word]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponents}
      >
        {renderableContent}
      </ReactMarkdown>
    </div>
  );
});
