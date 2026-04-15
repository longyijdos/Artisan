"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface ReasoningBlockProps {
  content: string;
  isStreaming: boolean;
}

export function ReasoningBlock({ content, isStreaming }: ReasoningBlockProps) {
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (isStreaming && isOpen && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isStreaming, isOpen]);

  if (!content) return null;

  const thinkingDuration = content.length > 0 ? estimateThinkingDuration(content) : null;

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-slate-100"
      >
        {/* Animated thinking indicator */}
        <span className="relative flex h-4 w-4 items-center justify-center">
          {isStreaming ? (
            <span className="flex gap-[3px]">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:300ms]" />
            </span>
          ) : (
            <svg
              className="h-4 w-4 text-violet-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5.002 5.002 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          )}
        </span>

        <span className="font-medium text-slate-600">
          {isStreaming ? "思考中..." : "已深度思考"}
        </span>

        {!isStreaming && thinkingDuration && (
          <span className="text-xs text-slate-400">
            ({thinkingDuration})
          </span>
        )}

        {/* Chevron */}
        <motion.svg
          className="ml-0.5 h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-slate-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              ref={contentRef}
              className="ml-2 max-h-[400px] overflow-y-auto border-l-2 border-violet-200 pl-4 pt-2 pb-1"
            >
              <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-500">
                {content}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function estimateThinkingDuration(content: string): string {
  // Rough estimate: ~4 chars per token, ~30 tokens/sec for reasoning
  const estimatedTokens = Math.ceil(content.length / 4);
  const estimatedSeconds = Math.max(1, Math.round(estimatedTokens / 30));

  if (estimatedSeconds < 60) {
    return `${estimatedSeconds} 秒`;
  }
  const minutes = Math.floor(estimatedSeconds / 60);
  const seconds = estimatedSeconds % 60;
  return seconds > 0 ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分钟`;
}
