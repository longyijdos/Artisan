"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import type {
  KnowledgeSourceContract,
  KnowledgeListResponseContract,
  KnowledgeDeleteResponseContract,
} from "@/lib/knowledge/contracts";

interface KnowledgePanelProps {
  onClose?: () => void;
}

export function KnowledgePanel({ onClose }: KnowledgePanelProps) {
  const [sources, setSources] = useState<KnowledgeSourceContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();

  const fetchSources = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/knowledge/list");
      const data = (await response.json()) as KnowledgeListResponseContract;
      if (response.ok && data.sources) {
        setSources(data.sources);
      } else {
        showToast("error", data.detail || "获取知识库列表失败");
      }
    } catch (err) {
      showToast("error", `获取知识库列表失败: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleDelete = async (source: KnowledgeSourceContract) => {
    const confirmed = await showConfirm({
      title: "删除知识源",
      message: `确定要删除 "${source.name}" 吗？关联的所有分块数据将一并删除。`,
      type: "danger",
      confirmText: "确认删除",
    });
    if (!confirmed) return;

    try {
      setDeleting(source.id);
      const response = await fetch(
        `/api/knowledge/delete?source_id=${source.id}`,
        { method: "DELETE" }
      );
      const data = (await response.json()) as KnowledgeDeleteResponseContract;

      if (response.ok && data.success) {
        setSources((prev) => prev.filter((s) => s.id !== source.id));
        showToast("success", `已删除 "${source.name}"`);
      } else {
        showToast("error", data.detail || "删除失败");
      }
    } catch (err) {
      showToast("error", `删除失败: ${err}`);
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-white via-[#fafbff] to-[#f5f7fb]">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-amber-100/60 bg-white/70 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">知识库</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              fetchSources();
              showToast("success", "列表已刷新");
            }}
            className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors rounded-lg hover:bg-amber-50/60"
            title="刷新列表"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4" style={{ overflowAnchor: "none" }}>
        {loading && sources.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 border-4 border-amber-100 border-t-amber-500 rounded-full animate-spin"></div>
          </div>
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            <p className="text-sm">暂无知识库</p>
            <p className="text-xs mt-1 text-slate-300">在工作区文件右键可添加</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((source) => (
              <div
                key={source.id}
                className="bg-white/90 rounded-xl border border-amber-100/50 p-3.5 flex items-center justify-between hover:shadow-[0_4px_12px_-4px_rgba(245,158,11,0.15)] transition-shadow duration-150"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    source.source_type === "folder" ? "bg-amber-50 text-amber-500" : "bg-blue-50 text-blue-500"
                  }`}>
                    {source.source_type === "folder" ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700 truncate">
                        {source.name}
                      </span>
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full flex-shrink-0 ${
                        source.source_type === "folder"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {source.source_type === "folder" ? "文件夹" : "文件"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-slate-400">
                        {source.chunk_count} 分块
                      </span>
                      <span className="text-[11px] text-slate-300">
                        {formatDate(source.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(source)}
                  disabled={deleting === source.id}
                  className={`p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50/80 transition-colors flex-shrink-0 ml-2 ${
                    deleting === source.id ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  title="删除"
                >
                  {deleting === source.id ? (
                    <div className="w-4 h-4 border-2 border-slate-200 border-t-red-400 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
