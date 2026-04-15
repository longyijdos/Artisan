"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ChatTextMessage, ChatTimelineItem, ChatToolCallItem } from "./types";
import { isFrontendToolName, normalizeAssistantDisplayContent } from "./utils";
import { BackendToolCall } from "./BackendToolCall";
import { ChatMarkdown } from "./ChatMarkdown";
import { FrontendToolCall } from "./FrontendToolCall";
import { ReasoningBlock } from "./ReasoningBlock";

const VIRTUALIZE_THRESHOLD = 80;
const VIRTUAL_OVERSCAN_PX = 900;
const TIMELINE_GAP_PX = 16;

interface ChatTimelineProps {
  displayTimeline: ChatTimelineItem[];
  isRunning: boolean;
  isHistoryLoading: boolean;
  historyError: string | null;
  showSessionSwitchingLoader: boolean;
  shouldShowWelcomeCard: boolean;
  preRunToolIds: Set<string>;
  onAskUserSubmit: (toolCallId: string, data: Record<string, string>) => Promise<void>;
  onExampleClick?: (text: string) => void;
  scrollContainer: HTMLElement | null;
}

interface ChatToolTimelineRowProps {
  item: ChatToolCallItem;
  shouldAnimate: boolean;
  onAskUserSubmit: (toolCallId: string, data: Record<string, string>) => Promise<void>;
}

const ChatToolTimelineRow = memo(function ChatToolTimelineRow({
  item,
  shouldAnimate,
  onAskUserSubmit,
}: ChatToolTimelineRowProps) {
  const isFrontendTool = isFrontendToolName(item.toolName);

  if (item.status === "exiting") {
    return (
      <motion.div
        initial={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        animate={{ opacity: 0, y: -8, scale: 0.97, filter: "blur(2px)" }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="flex w-full justify-start overflow-hidden"
      >
        <div className="w-full min-w-0">
          <BackendToolCall
            toolName={item.toolName}
            args={item.args}
            result={item.result}
            status="loading"
            animate={false}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={shouldAnimate ? { opacity: 0, y: 10, scale: 0.985, filter: "blur(1px)" } : false}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="flex w-full justify-start"
    >
      <div className="w-full min-w-0">
        {isFrontendTool ? (
          <FrontendToolCall
            toolCallId={item.toolCallId}
            toolName={item.toolName}
            args={item.args}
            result={item.result}
            status={item.status}
            pending={item.pending}
            animate={shouldAnimate}
            onAskUserSubmit={onAskUserSubmit}
          />
        ) : (
          <BackendToolCall
            toolName={item.toolName}
            args={item.args}
            result={item.result}
            status={item.status}
            animate={shouldAnimate}
          />
        )}
      </div>
    </motion.div>
  );
});

interface ChatTextTimelineRowProps {
  item: ChatTextMessage;
  nextItemKind: ChatTimelineItem["kind"] | null;
}

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0B";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const fixed = value >= 100 || index === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(fixed)}${units[index]}`;
}

function getAttachmentTypeLabel(name: string, mimeType?: string): string {
  const trimmed = name.trim();
  const dotIndex = trimmed.lastIndexOf(".");
  if (dotIndex > 0 && dotIndex < trimmed.length - 1) {
    return trimmed.slice(dotIndex + 1).toUpperCase();
  }
  return (mimeType || "FILE").split("/").pop()?.toUpperCase() || "FILE";
}

const ChatTextTimelineRow = memo(function ChatTextTimelineRow({
  item,
  nextItemKind,
}: ChatTextTimelineRowProps) {
  const isUser = item.role === "user";
  if (!isUser && item.status !== "streaming" && item.content.trim().length === 0 && !item.reasoningContent) {
    return null;
  }

  const shouldTrimTrailingNewlines =
    !isUser && item.status !== "streaming" && nextItemKind === "tool";
  const displayContent = isUser
    ? item.content
    : normalizeAssistantDisplayContent(
        item.content,
        shouldTrimTrailingNewlines,
      );

  return (
    <div className={`w-full ${isUser ? "" : "flex justify-start"}`}>
      {isUser && item.attachments && item.attachments.length > 0 && (
        <div className="mb-2 ml-auto w-full">
          <div className="grid grid-cols-3 gap-2 [direction:rtl]">
            {item.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex max-w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-700 shadow-sm [direction:ltr]"
                title={attachment.path}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h10M7 11h10M7 15h6M6 3h9l3 3v15H6z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{attachment.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {getAttachmentTypeLabel(attachment.name, attachment.mimeType)} {formatFileSize(attachment.size)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`min-w-0 ${isUser ? "ml-auto w-fit max-w-[80%]" : "w-full"}`}>
        <div
          className={`min-w-0 break-words [overflow-wrap:anywhere] [word-break:break-word] ${
            isUser
              ? "ml-auto w-fit whitespace-pre-wrap rounded-[24px] border border-indigo-300/35 bg-gradient-to-r from-indigo-500 via-indigo-500 to-violet-500 px-4 py-2.5 text-[15px] leading-6 text-white shadow-[0_10px_24px_-18px_rgba(79,70,229,0.75)]"
              : "w-full px-1 text-slate-800"
          }`}
        >
          {isUser ? (
            <>{displayContent}</>
          ) : (
            <>
              {item.reasoningContent && (
                <ReasoningBlock
                  content={item.reasoningContent}
                  isStreaming={item.status === "streaming" && !displayContent}
                />
              )}
              <ChatMarkdown content={displayContent} />
            </>
          )}
        </div>
      </div>
    </div>
  );
});

interface TimelineRowModel {
  item: ChatTimelineItem;
  nextItemKind: ChatTimelineItem["kind"] | null;
  shouldAnimate: boolean;
}

const WELCOME_EXAMPLES = [
  {
    title: "代码与文件改动",
    description: "例如：创建或修改文件、重构模块、补测试、整理目录结构。",
    prompt: "帮我重构这个模块，拆分成更小的文件并补上单测",
  },
  {
    title: "命令执行与问题排查",
    description: "例如：运行脚本、安装依赖、定位报错并提供可验证的修复方案。",
    prompt: "这个构建报错怎么修，顺便解释一下原因",
  },
  {
    title: "任务拆解与执行计划",
    description: "把复杂需求拆成清晰步骤，按优先级推进并同步进展。",
    prompt: "帮我把这个需求拆解成可执行的步骤，按优先级排列",
  },
  {
    title: "资料检索与方案对比",
    description: "需要时先查资料再给结论，附带可落地建议与取舍说明。",
    prompt: "对比一下这几种方案的优缺点，给出推荐",
  },
] as const;

function estimateRowHeight(item: ChatTimelineItem): number {
  if (item.kind === "tool") return 220;
  if (item.role === "user") {
    const attachmentCount = item.attachments?.length ?? 0;
    const attachmentRows = attachmentCount > 0 ? Math.ceil(attachmentCount / 3) : 0;
    return 76 + attachmentRows * 88;
  }
  const contentLength = item.content.length + (item.reasoningContent?.length ?? 0);
  return Math.max(120, Math.min(520, 110 + Math.floor(contentLength / 5)));
}

function lowerBound(values: number[], target: number): number {
  let left = 0;
  let right = values.length;
  while (left < right) {
    const mid = (left + right) >> 1;
    if (values[mid] < target) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left;
}

function renderTimelineRow(
  row: TimelineRowModel,
  onAskUserSubmit: (toolCallId: string, data: Record<string, string>) => Promise<void>,
) {
  if (row.item.kind === "tool") {
    return (
      <ChatToolTimelineRow
        item={row.item}
        shouldAnimate={row.shouldAnimate}
        onAskUserSubmit={onAskUserSubmit}
      />
    );
  }

  return (
    <ChatTextTimelineRow
      item={row.item}
      nextItemKind={row.nextItemKind}
    />
  );
}

export function ChatTimeline({
  displayTimeline,
  isRunning,
  isHistoryLoading,
  historyError,
  showSessionSwitchingLoader,
  shouldShowWelcomeCard,
  preRunToolIds,
  onAskUserSubmit,
  onExampleClick,
  scrollContainer,
}: ChatTimelineProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [rowHeights, setRowHeights] = useState<Map<string, number>>(new Map());
  const rowObserverRef = useRef<Map<string, ResizeObserver>>(new Map());
  const rowElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingHeightUpdatesRef = useRef<Map<string, number>>(new Map());
  const heightFlushRafRef = useRef<number | null>(null);
  const prevRowSizesRef = useRef<number[] | null>(null);

  const timelineRows = useMemo<TimelineRowModel[]>(() => {
    return displayTimeline.map((item, index) => ({
      item,
      nextItemKind: displayTimeline[index + 1]?.kind ?? null,
      shouldAnimate: item.kind === "tool" ? (isRunning && !preRunToolIds.has(item.id)) : false,
    }));
  }, [displayTimeline, isRunning, preRunToolIds]);

  useEffect(() => {
    const validIds = new Set(displayTimeline.map((item) => item.id));

    rowObserverRef.current.forEach((observer, id) => {
      if (validIds.has(id)) return;
      observer.disconnect();
      rowObserverRef.current.delete(id);
      rowElementsRef.current.delete(id);
      pendingHeightUpdatesRef.current.delete(id);
    });
  }, [displayTimeline]);

  useEffect(() => {
    if (!scrollContainer) return;

    const updateMetrics = () => {
      setScrollTop(scrollContainer.scrollTop);
      setViewportHeight(scrollContainer.clientHeight);
    };

    updateMetrics();
    scrollContainer.addEventListener("scroll", updateMetrics, { passive: true });

    if (typeof ResizeObserver === "undefined") {
      return () => {
        scrollContainer.removeEventListener("scroll", updateMetrics);
      };
    }

    const observer = new ResizeObserver(updateMetrics);
    observer.observe(scrollContainer);

    return () => {
      scrollContainer.removeEventListener("scroll", updateMetrics);
      observer.disconnect();
    };
  }, [scrollContainer]);

  useEffect(() => {
    const observerMap = rowObserverRef.current;
    const elementMap = rowElementsRef.current;
    const pendingMap = pendingHeightUpdatesRef.current;
    return () => {
      observerMap.forEach((observer) => observer.disconnect());
      observerMap.clear();
      elementMap.clear();
      pendingMap.clear();
      if (heightFlushRafRef.current !== null) {
        window.cancelAnimationFrame(heightFlushRafRef.current);
        heightFlushRafRef.current = null;
      }
    };
  }, []);

  const flushPendingHeightUpdates = useCallback(() => {
    if (heightFlushRafRef.current !== null) {
      window.cancelAnimationFrame(heightFlushRafRef.current);
      heightFlushRafRef.current = null;
    }
    const pending = pendingHeightUpdatesRef.current;
    if (pending.size === 0) return;
    const entries = Array.from(pending.entries());
    pending.clear();
    setRowHeights((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [id, height] of entries) {
        const prevHeight = next.get(id) ?? 0;
        if (Math.abs(height - prevHeight) < 1) continue;
        next.set(id, height);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  const scheduleHeightFlush = useCallback(() => {
    if (heightFlushRafRef.current !== null) return;
    heightFlushRafRef.current = window.requestAnimationFrame(() => {
      heightFlushRafRef.current = null;
      flushPendingHeightUpdates();
    });
  }, [flushPendingHeightUpdates]);

  const bindMeasuredRow = useCallback((id: string, node: HTMLDivElement | null) => {
    const previousNode = rowElementsRef.current.get(id);
    if (previousNode === node) {
      return;
    }

    const prevObserver = rowObserverRef.current.get(id);
    if (prevObserver) {
      prevObserver.disconnect();
      rowObserverRef.current.delete(id);
    }

    if (!node) {
      rowElementsRef.current.delete(id);
      pendingHeightUpdatesRef.current.delete(id);
      return;
    }

    rowElementsRef.current.set(id, node);

    const updateHeight = () => {
      const nextHeight = node.getBoundingClientRect().height;
      pendingHeightUpdatesRef.current.set(id, nextHeight);
      scheduleHeightFlush();
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(node);
    rowObserverRef.current.set(id, observer);
  }, [scheduleHeightFlush]);

  const shouldVirtualize = timelineRows.length >= VIRTUALIZE_THRESHOLD && Boolean(scrollContainer);

  const rowSizes = useMemo(() => {
    return timelineRows.map((row) => rowHeights.get(row.item.id) ?? estimateRowHeight(row.item));
  }, [rowHeights, timelineRows]);

  const virtualState = useMemo(() => {
    if (!shouldVirtualize || timelineRows.length === 0) {
      return null;
    }

    const offsets = new Array<number>(timelineRows.length);
    const ends = new Array<number>(timelineRows.length);
    let cursor = 0;

    for (let i = 0; i < timelineRows.length; i++) {
      offsets[i] = cursor;
      cursor += rowSizes[i];
      ends[i] = cursor;
      if (i < timelineRows.length - 1) {
        cursor += TIMELINE_GAP_PX;
      }
    }

    const totalHeight = cursor;
    const viewportStart = Math.max(0, scrollTop - VIRTUAL_OVERSCAN_PX);
    const viewportEnd = scrollTop + viewportHeight + VIRTUAL_OVERSCAN_PX;

    const startIndex = Math.min(
      timelineRows.length - 1,
      lowerBound(ends, viewportStart),
    );
    const exclusiveEnd = Math.max(startIndex + 1, lowerBound(offsets, viewportEnd + 1));
    const endIndex = Math.min(timelineRows.length - 1, exclusiveEnd - 1);

    return {
      totalHeight,
      offsets,
      startIndex,
      endIndex,
    };
  }, [shouldVirtualize, timelineRows.length, rowSizes, scrollTop, viewportHeight]);

  useEffect(() => {
    if (!shouldVirtualize || !scrollContainer) {
      prevRowSizesRef.current = rowSizes;
      return;
    }

    const previous = prevRowSizesRef.current;
    if (!previous || previous.length !== rowSizes.length) {
      prevRowSizesRef.current = rowSizes;
      return;
    }

    const anchorIndex = Math.max(0, virtualState?.startIndex ?? 0);
    let deltaBeforeAnchor = 0;
    for (let i = 0; i < anchorIndex; i++) {
      deltaBeforeAnchor += rowSizes[i] - previous[i];
    }

    if (Math.abs(deltaBeforeAnchor) > 1) {
      const nextScrollTop = Math.max(0, scrollContainer.scrollTop + deltaBeforeAnchor);
      if (Math.abs(nextScrollTop - scrollContainer.scrollTop) > 0.5) {
        scrollContainer.scrollTo({ top: nextScrollTop, behavior: "auto" });
      }
    }

    prevRowSizesRef.current = rowSizes;
  }, [rowSizes, scrollContainer, shouldVirtualize, virtualState?.startIndex]);

  return (
    <div className="space-y-4">
      {displayTimeline.length === 0 && isHistoryLoading && showSessionSwitchingLoader && (
        <div className="flex min-h-[38vh] w-full items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-white/92 px-5 py-4 shadow-[0_14px_30px_-22px_rgba(79,70,229,0.55)]">
            <span className="relative inline-flex h-5 w-5">
              <span className="absolute inset-0 rounded-full border-2 border-indigo-200" />
              <span className="absolute inset-0 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-slate-700">正在加载会话</p>
              <p className="text-xs text-slate-500">历史消息加载中...</p>
            </div>
          </div>
        </div>
      )}

      {displayTimeline.length === 0 && !isHistoryLoading && historyError && (
        <div className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700 shadow-sm">
          历史消息加载失败：{historyError}
        </div>
      )}

      <AnimatePresence initial={false}>
        {shouldShowWelcomeCard && (
          <motion.div
            key="welcome-card"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="pointer-events-none absolute inset-x-0 top-0 z-10 flex min-h-[44vh] w-full items-center justify-center"
          >
            <div className="w-full max-w-[min(88%,860px)] rounded-3xl border border-indigo-100/80 bg-white/90 px-6 py-6 shadow-[0_20px_44px_-30px_rgba(79,70,229,0.45)] backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6l4 2M22 12a10 10 0 11-20 0 10 10 0 0120 0z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-800">开始一段新对话</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    直接输入你的目标、问题或想法。
                    我会先澄清需求，再给出可执行步骤并帮你推进到落地。
                  </p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {WELCOME_EXAMPLES.map((example) => (
                  <button
                    key={example.title}
                    type="button"
                    onClick={() => onExampleClick?.(example.prompt)}
                    className="pointer-events-auto rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50/60"
                  >
                    <p className="text-sm font-medium text-slate-700">{example.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {example.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!shouldVirtualize && (
        <div className="space-y-4">
          {timelineRows.map((row) => (
            <div key={row.item.id}>
              {renderTimelineRow(row, onAskUserSubmit)}
            </div>
          ))}
        </div>
      )}

      {shouldVirtualize && virtualState && (
        <div
          className="relative w-full"
          style={{ height: virtualState.totalHeight }}
        >
          {timelineRows.slice(virtualState.startIndex, virtualState.endIndex + 1).map((row, localIndex) => {
            const index = virtualState.startIndex + localIndex;
            return (
              <div
                key={row.item.id}
                ref={(node) => bindMeasuredRow(row.item.id, node)}
                className="absolute left-0 right-0"
                style={{ top: virtualState.offsets[index] }}
              >
                {renderTimelineRow(row, onAskUserSubmit)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
