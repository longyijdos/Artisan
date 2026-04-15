
"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { motion, AnimatePresence } from "framer-motion";
import type {
  SkillContract,
  SkillMutationResponseContract,
} from "@/lib/skills/contracts";
import { SkillDetailDialog } from "./SkillDetailDialog";
import { SkillUploadDialog } from "./SkillUploadDialog";

export type Skill = SkillContract;

interface SkillsLibraryProps {
  sessionId: string;
  skills: Skill[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onUpdateSkill: (skillName: string, newStatus: "installed" | "available" | "core") => void;
  onClose?: () => void;
}

export function SkillsLibrary({ 
  sessionId,
  skills,
  loading,
  error,
  onRefresh,
  onUpdateSkill,
  onClose
}: SkillsLibraryProps) {
  const [processing, setProcessing] = useState<string | null>(null); // Skill name being processed
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [isLayoutResizing, setIsLayoutResizing] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const onLayoutResize = (event: Event) => {
      const customEvent = event as CustomEvent<{ dragging?: boolean }>;
      setIsLayoutResizing(Boolean(customEvent.detail?.dragging));
    };

    window.addEventListener("artisan:layout-resize", onLayoutResize as EventListener);
    return () => {
      window.removeEventListener("artisan:layout-resize", onLayoutResize as EventListener);
    };
  }, []);

  const handleInstall = async (skillName: string) => {
    try {
      setProcessing(skillName);
      const response = await fetch("/api/skills/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill_name: skillName, thread_id: sessionId }),
      });
      
      if (!response.ok) {
        const data = (await response.json()) as SkillMutationResponseContract;
        throw new Error(data.detail || "Failed to install skill");
      }
      
      // Optimistic update
      onUpdateSkill(skillName, "installed");
      showToast("success", `技能 "${skillName}" 安装成功`);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "安装失败");
    } finally {
      setProcessing(null);
    }
  };

  const handleUninstall = async (skillName: string) => {
    try {
      setProcessing(skillName);
      const response = await fetch("/api/skills/uninstall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill_name: skillName, thread_id: sessionId }),
      });
      
      if (!response.ok) {
        const data = (await response.json()) as SkillMutationResponseContract;
        throw new Error(data.detail || "Failed to uninstall skill");
      }
      
      // Optimistic update
      onUpdateSkill(skillName, "available");
      showToast("success", `技能 "${skillName}" 卸载成功`);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "卸载失败");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-white via-[#fafbff] to-[#f5f7fb]">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-indigo-100/40 bg-white/70 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-violet-50 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">技能库</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowUploadDialog(true)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-indigo-50/60"
            title="上传技能"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </button>
          <button
            onClick={async () => {
              onRefresh();
              showToast("success", "列表已刷新");
            }}
            className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-indigo-50/60"
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
      <div 
        className="flex-1 overflow-y-auto p-6" 
        style={{ overflowAnchor: "none" }}
      >
        {loading && skills.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-red-500">
            <svg className="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p>{error}</p>
            <button 
              onClick={onRefresh}
              className="mt-4 px-4 py-2 bg-white/90 border border-indigo-200/60 rounded-xl text-sm text-slate-600 hover:bg-indigo-50/60 shadow-sm transition-colors"
            >
              重试
            </button>
          </div>
        ) : skills.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p>暂无可用技能</p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity duration-300 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <AnimatePresence>
              {skills.map((skill) => (
                <motion.div 
                  layout={!isLayoutResizing}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  key={skill.name} 
                  className={`
                    bg-white/90 rounded-2xl border p-5 flex flex-col
                    ${skill.status === 'installed' ? 'border-indigo-200/60 shadow-[0_6px_20px_-8px_rgba(79,70,229,0.2)]' : 'border-indigo-100/50 hover:border-indigo-200/60'}
                    shadow-sm hover:shadow-[0_10px_30px_-12px_rgba(79,70,229,0.25)] transition-[box-shadow,border-color] duration-200
                  `}
                >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                      ${skill.status === 'installed' ? 'bg-indigo-50/80 text-indigo-600' : 'bg-slate-100/80 text-slate-500'}
                      ${skill.status === 'core' ? 'bg-blue-50/80 text-blue-600' : ''}
                    `}>
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{skill.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {skill.status === 'core' && (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded-full">核心</span>
                        )}
                        {skill.status === 'installed' && (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded-full">已安装</span>
                        )}
                         {skill.status === 'available' && (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded-full">未安装</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 mb-4">
                  <p className="text-sm text-slate-500 line-clamp-3">
                    {skill.description || "暂无描述"}
                  </p>
                </div>

                <div className="mt-auto pt-4 border-t border-indigo-100/40 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedSkill(skill)}
                    className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    详情
                  </button>
                  
                  {skill.status === 'core' ? (
                    <button 
                      disabled
                      className="px-3 py-1.5 text-xs font-medium text-slate-400 bg-slate-100/80 rounded-lg cursor-not-allowed"
                    >
                      系统内置
                    </button>
                  ) : skill.status === 'installed' ? (
                    <button 
                      onClick={() => handleUninstall(skill.name)}
                      disabled={processing === skill.name}
                      className={`
                        px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50/80 hover:bg-red-100/80 rounded-lg transition-colors
                        ${processing === skill.name ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      {processing === skill.name ? '卸载中...' : '卸载'}
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleInstall(skill.name)}
                      disabled={processing === skill.name}
                      className={`
                        px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-[0_4px_12px_-4px_rgba(79,70,229,0.4)]
                        ${processing === skill.name ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      {processing === skill.name ? '安装中...' : '安装'}
                    </button>
                  )}
                </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <AnimatePresence>
          {selectedSkill && (
            <SkillDetailDialog
              skill={selectedSkill}
              onClose={() => setSelectedSkill(null)}
            />
          )}
        </AnimatePresence>

        {showUploadDialog && (
          <SkillUploadDialog
            sessionId={sessionId}
            onClose={() => setShowUploadDialog(false)}
            onSuccess={() => {
              onRefresh();
              showToast("success", "技能上传成功");
            }}
          />
        )}
      </div>
    </div>
  );
}
