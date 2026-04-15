"use client";

import { DragEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ComposerAttachment } from "./types";
import type { KnowledgeSourceContract, KnowledgeListResponseContract } from "@/lib/knowledge/contracts";
import type { TokenUsage } from "./hooks/chatStreamTurn";

interface ChatComposerProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => Promise<void>;
  onStop: () => Promise<void>;
  reasoningEnabled: boolean;
  onReasoningToggle: () => void;
  selectedKnowledgeIds: number[];
  onKnowledgeIdsChange: (ids: number[]) => void;
  attachments: ComposerAttachment[];
  onPickFiles: (files: File[]) => Promise<void>;
  onRemoveAttachment: (attachmentId: string) => void;
  isRunning: boolean;
  isDisabled: boolean;
  composerRef: React.RefObject<HTMLFormElement | null>;
  activeThreadId: string | null;
  tokenUsage: TokenUsage;
}

export function ChatComposer({
  inputValue,
  onInputChange,
  onSend,
  onStop,
  reasoningEnabled,
  onReasoningToggle,
  selectedKnowledgeIds,
  onKnowledgeIdsChange,
  attachments,
  onPickFiles,
  onRemoveAttachment,
  isRunning,
  isDisabled,
  composerRef,
  activeThreadId,
  tokenUsage,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [knowledgePickerOpen, setKnowledgePickerOpen] = useState(false);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSourceContract[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const knowledgePickerRef = useRef<HTMLDivElement | null>(null);
  const [tokenRingHover, setTokenRingHover] = useState(false);

  const resizeComposerInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, 224);
    textarea.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    resizeComposerInput();
  }, [activeThreadId, inputValue, resizeComposerInput]);

  // Close knowledge picker on outside click
  useEffect(() => {
    if (!knowledgePickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (knowledgePickerRef.current && !knowledgePickerRef.current.contains(e.target as Node)) {
        setKnowledgePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [knowledgePickerOpen]);

  // Fetch knowledge sources when picker opens
  const openKnowledgePicker = useCallback(async () => {
    if (knowledgePickerOpen) {
      setKnowledgePickerOpen(false);
      return;
    }
    setKnowledgePickerOpen(true);
    setKnowledgeLoading(true);
    try {
      const res = await fetch("/api/knowledge/list");
      const data = (await res.json()) as KnowledgeListResponseContract;
      if (res.ok && data.sources) {
        setKnowledgeSources(data.sources);
      }
    } catch {
      // Silently fail
    } finally {
      setKnowledgeLoading(false);
    }
  }, [knowledgePickerOpen]);

  const toggleKnowledgeSource = useCallback((id: number) => {
    onKnowledgeIdsChange(
      selectedKnowledgeIds.includes(id)
        ? selectedKnowledgeIds.filter((sid) => sid !== id)
        : [...selectedKnowledgeIds, id]
    );
  }, [selectedKnowledgeIds, onKnowledgeIdsChange]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSend();
  };

  const hasUploadingAttachment = attachments.some((item) => item.uploadStatus === "uploading");
  const uploadButtonDisabled = isDisabled || isRunning || hasUploadingAttachment;

  const formatFileSize = useCallback((size: number) => {
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
  }, []);

  const getAttachmentTypeLabel = useCallback((name: string, mimeType?: string) => {
    const trimmed = name.trim();
    const dotIndex = trimmed.lastIndexOf(".");
    if (dotIndex > 0 && dotIndex < trimmed.length - 1) {
      return trimmed.slice(dotIndex + 1).toUpperCase();
    }
    return (mimeType || "FILE").split("/").pop()?.toUpperCase() || "FILE";
  }, []);

  const onDragOver = useCallback((event: DragEvent<HTMLFormElement>) => {
    if (uploadButtonDisabled) return;
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, [uploadButtonDisabled]);

  const onDrop = useCallback((event: DragEvent<HTMLFormElement>) => {
    if (uploadButtonDisabled) return;
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    void onPickFiles(Array.from(files));
  }, [onPickFiles, uploadButtonDisabled]);

  const hasSelectedKnowledge = selectedKnowledgeIds.length > 0;

  const formatTokenCount = useCallback((tokens: number) => {
    if (tokens >= 1000) {
      const k = tokens / 1000;
      return k >= 100 ? `${Math.round(k)}K` : `${k.toFixed(1).replace(/\.0$/, "")}K`;
    }
    return String(tokens);
  }, []);

  const tokenUsageRatio = tokenUsage.totalTokens / tokenUsage.contextWindow;
  const tokenStrokeClass =
    tokenUsageRatio > 0.9
      ? "stroke-red-500"
      : tokenUsageRatio > 0.75
        ? "stroke-amber-500"
        : "stroke-slate-400";
  const tokenColorClass =
    tokenUsageRatio > 0.9
      ? "text-red-500"
      : tokenUsageRatio > 0.75
        ? "text-amber-500"
        : "text-slate-400";
  const tokenPercent = Math.min(Math.round(tokenUsageRatio * 100), 100);
  const ringRadius = 10;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - tokenUsageRatio);

  return (
    <form
      ref={composerRef}
      onSubmit={onSubmit}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="pointer-events-auto mx-auto flex w-full flex-col rounded-[22px] border border-indigo-200/80 bg-white/95 px-4 py-3 shadow-[0_14px_32px_-22px_rgba(79,70,229,0.45)] backdrop-blur"
    >
      {attachments.length > 0 && (
        <div className="mb-2 -mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-max gap-2.5">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="w-[300px] max-w-[78vw] shrink-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm"
                title={attachment.path}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h10M7 11h10M7 15h6M6 3h9l3 3v15H6z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{attachment.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {attachment.uploadStatus === "uploading"
                        ? "上传中..."
                        : attachment.uploadStatus === "error"
                          ? "上传失败"
                          : `${getAttachmentTypeLabel(attachment.name, attachment.mimeType)} ${formatFileSize(attachment.size)}`}
                    </p>
                  </div>
                  {attachment.uploadStatus !== "uploading" && (
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(attachment.id)}
                      disabled={isDisabled || isRunning}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                      title="移除附件"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {attachment.uploadStatus === "uploading" && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-indigo-500/75" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={inputValue}
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void onSend();
          }
        }}
        placeholder="输入你的需求..."
        disabled={isDisabled}
        rows={1}
        className="w-full min-h-[52px] max-h-44 resize-none overflow-y-auto border-0 bg-transparent px-1 py-0 text-[14px] leading-[20px] text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReasoningToggle}
            disabled={isDisabled}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              reasoningEnabled
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            } disabled:cursor-not-allowed disabled:opacity-60`}
            aria-pressed={reasoningEnabled}
            title="深度思考"
          >
            <span aria-hidden="true" className="text-[14px] leading-none">✦</span>
            <span>深度思考</span>
          </button>

          {/* Knowledge base picker */}
          <div className="relative" ref={knowledgePickerRef}>
            <button
              type="button"
              onClick={openKnowledgePicker}
              disabled={isDisabled}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                hasSelectedKnowledge
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              } disabled:cursor-not-allowed disabled:opacity-60`}
              title="知识库"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
              <span>知识库</span>
              {hasSelectedKnowledge && (
                <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                  {selectedKnowledgeIds.length}
                </span>
              )}
            </button>

            <AnimatePresence>
              {knowledgePickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-amber-100/80 bg-white/98 shadow-[0_10px_30px_-12px_rgba(245,158,11,0.25)] backdrop-blur-sm overflow-hidden z-50"
                >
                  <div className="px-3 py-2 border-b border-amber-100/50">
                    <p className="text-xs font-semibold text-amber-700">选择知识库</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">勾选后发送消息将检索对应知识库</p>
                  </div>
                  <div className="max-h-52 overflow-y-auto py-1">
                    {knowledgeLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="w-5 h-5 border-2 border-amber-100 border-t-amber-500 rounded-full animate-spin" />
                      </div>
                    ) : knowledgeSources.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        暂无知识库
                      </div>
                    ) : (
                      knowledgeSources.map((source) => {
                        const isSelected = selectedKnowledgeIds.includes(source.id);
                        return (
                          <button
                            key={source.id}
                            type="button"
                            onClick={() => toggleKnowledgeSource(source.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                              isSelected ? "bg-amber-50/60" : "hover:bg-slate-50/60"
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected
                                ? "border-amber-500 bg-amber-500"
                                : "border-slate-300"
                            }`}>
                              {isSelected && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-slate-700 truncate">{source.name}</p>
                              <p className="text-[10px] text-slate-400">{source.chunk_count} 分块</p>
                            </div>
                            <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded-full flex-shrink-0 ${
                              source.source_type === "folder"
                                ? "bg-amber-100 text-amber-600"
                                : "bg-blue-100 text-blue-600"
                            }`}>
                              {source.source_type === "folder" ? "文件夹" : "文件"}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                  {hasSelectedKnowledge && (
                    <div className="px-3 py-2 border-t border-amber-100/50">
                      <button
                        type="button"
                        onClick={() => onKnowledgeIdsChange([])}
                        className="text-[11px] text-slate-400 hover:text-red-500 transition-colors"
                      >
                        清除选择
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = event.target.files;
              if (!files || files.length === 0) return;
              const snapshot = Array.from(files);
              void onPickFiles(snapshot);
              event.target.value = "";
            }}
          />

          {/* Token usage ring */}
          <div
            className="relative"
            onMouseEnter={() => setTokenRingHover(true)}
            onMouseLeave={() => setTokenRingHover(false)}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" className="block">
              {/* Background ring */}
              <circle
                cx="14"
                cy="14"
                r={ringRadius}
                fill="none"
                strokeWidth="2.5"
                className="stroke-slate-200"
              />
              {/* Progress ring */}
              <circle
                cx="14"
                cy="14"
                r={ringRadius}
                fill="none"
                strokeWidth="2.5"
                strokeLinecap="round"
                className={`${tokenStrokeClass} transition-all duration-300`}
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                transform="rotate(-90 14 14)"
              />
              {/* Center percentage text */}
              <text
                x="14"
                y="14"
                textAnchor="middle"
                dominantBaseline="central"
                className={`${tokenUsage.totalTokens > 0 ? tokenColorClass : "text-slate-300"} text-[7px] font-semibold`}
                fill="currentColor"
              >
                {tokenUsage.totalTokens > 0 ? `${tokenPercent}%` : "–"}
              </text>
            </svg>

            {/* Hover tooltip */}
            <AnimatePresence>
              {tokenRingHover && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-lg border border-slate-200/80 bg-white/98 px-3 py-2 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur-sm z-50"
                >
                  {tokenUsage.totalTokens > 0 ? (
                    <p className="text-xs font-medium text-slate-700">
                      已用 {formatTokenCount(tokenUsage.totalTokens)} / {formatTokenCount(tokenUsage.contextWindow)}
                      <span className={`ml-1.5 ${tokenColorClass}`}>({tokenPercent}%)</span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">发送消息后查看 Token 用量</p>
                  )}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadButtonDisabled}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            title="上传文件"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 010-8h.5A5.5 5.5 0 0118 9.5h.5a3.5 3.5 0 010 7H17M12 12v7m0-7l-3 3m3-3l3 3" />
            </svg>
          </button>

          {isRunning ? (
            <button
              type="button"
              onClick={() => void onStop()}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
              title="停止生成"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
          <button
            type="submit"
            disabled={!inputValue.trim() || isDisabled || hasUploadingAttachment}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            title="发送"
          >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
