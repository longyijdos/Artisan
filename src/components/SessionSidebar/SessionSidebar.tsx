import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Session } from "@/lib/session/types";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { SessionItem } from "./SessionItem";

interface SessionSidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  isLoading: boolean;
  isAgentRunning?: boolean;
  onCreateSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => Promise<boolean>;
  onRenameSession: (id: string, newTitle: string) => Promise<boolean> | void;
  // Workspace toggle
  showWorkspace?: boolean;
  onToggleWorkspace?: () => void;
  // Terminal toggle
  showTerminal?: boolean;
  onToggleTerminal?: () => void;
  // Skills toggle
  showSkills?: boolean;
  onToggleSkills?: () => void;
  // Knowledge toggle
  showKnowledge?: boolean;
  onToggleKnowledge?: () => void;
}

export function SessionSidebar({
  sessions,
  currentSessionId,
  isLoading,
  isAgentRunning = false,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  showWorkspace = false,
  onToggleWorkspace,
  showTerminal = false,
  onToggleTerminal,
  showSkills = false,
  onToggleSkills,
  showKnowledge = false,
  onToggleKnowledge,
}: SessionSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  );
  const editInputRef = useRef<HTMLInputElement>(null);
  const { showConfirm } = useConfirm();
  const { showToast } = useToast();

  // Persist collapsed state
  const toggleCollapsed = (value: boolean) => {
    setCollapsed(value);
    localStorage.setItem('sidebar-collapsed', String(value));
  };

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  const handleStartEdit = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditValue(session.title);
  };

  const handleSaveEdit = async () => {
    if (editingId && editValue.trim()) {
      await onRenameSession(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    const sessionTitle = session.title || "新对话";
    const confirmed = await showConfirm({
      title: "删除对话",
      message: `确定要删除对话 "${sessionTitle}" 吗？此操作不可恢复。`,
      type: "danger",
      confirmText: "确认删除"
    });
    if (confirmed) {
      const success = await onDeleteSession(session.id);
      if (success) {
        showToast("success", `已删除对话 "${sessionTitle}"`);
      } else {
        showToast("error", `删除对话 "${sessionTitle}" 失败`);
      }
    }
  };

  // Collapsed sidebar = 56px. We use px-[10px] on the container
  // and each icon button is w-9 h-9 (36px), centered in the 36px
  // space (56 - 10*2 = 36). The hamburger icon uses the same 36px box.

  return (
    <motion.div 
      initial={false}
      animate={{ width: collapsed ? 56 : 260 }}
      transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
      className="h-full bg-gradient-to-b from-white/95 via-[#f8f9ff]/90 to-[#f1f3fb]/85 border-r border-indigo-100/40 flex flex-col overflow-hidden flex-shrink-0"
    >
      {/* Header */}
      <div className="border-b border-indigo-100/30 bg-white/70 backdrop-blur-sm flex-shrink-0 px-[10px]">
        <div className="py-3">
          {/* Logo row — click to toggle collapse */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => toggleCollapsed(!collapsed)}
              className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shadow-indigo-200/60 shrink-0 hover:shadow-md hover:shadow-indigo-300/40 transition-shadow duration-150 cursor-pointer"
              title={collapsed ? "展开侧边栏" : "收起侧边栏"}
            >
              <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            {!collapsed && (
              <div className="shrink-0">
                <h1 className="text-sm font-bold text-slate-800 leading-tight">Artisan</h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-wider">AI CRAFTSMAN</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="py-1.5 px-[10px] flex-shrink-0 space-y-0.5">
        <button
          onClick={onCreateSession}
          className="relative flex items-center w-full h-9 px-2 rounded-xl transition-all duration-150 text-slate-500 hover:text-indigo-500 hover:bg-indigo-50/60"
          title="发起新对话"
        >
          <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          {!collapsed && (
            <span className="text-[13px] font-medium whitespace-nowrap ml-3">创建新对话</span>
          )}
        </button>

        {/* Divider */}
        <div className="mx-1 my-1">
          <div className="h-px bg-indigo-100/40" />
        </div>

        {onToggleWorkspace && (
          <button
            onClick={onToggleWorkspace}
            className={`
              relative flex items-center w-full h-9 px-2 rounded-xl transition-all duration-150
              ${showWorkspace 
                ? 'text-blue-600 bg-white/80 shadow-[0_2px_8px_-3px_rgba(59,130,246,0.3)] ring-1 ring-blue-100/60 font-medium' 
                : 'text-slate-500 hover:text-blue-500 hover:bg-blue-50/50'
              }
            `}
            title={showWorkspace ? "关闭工作区" : "打开工作区"}
          >
            {showWorkspace && !collapsed && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-blue-500" />}
            <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            {!collapsed && (
              <span className="text-[13px] whitespace-nowrap ml-3">{showWorkspace ? '关闭工作区' : '打开工作区'}</span>
            )}
          </button>
        )}

        {onToggleTerminal && (
          <button
            onClick={onToggleTerminal}
            className={`
              relative flex items-center w-full h-9 px-2 rounded-xl transition-all duration-150
              ${showTerminal 
                ? 'text-slate-700 bg-white/80 shadow-[0_2px_8px_-3px_rgba(71,85,105,0.3)] ring-1 ring-slate-200/60 font-medium' 
                : 'text-slate-500 hover:text-slate-600 hover:bg-slate-100/50'
              }
            `}
            title={showTerminal ? "关闭控制台" : "打开控制台"}
          >
            {showTerminal && !collapsed && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-slate-600" />}
            <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {!collapsed && (
              <span className="text-[13px] whitespace-nowrap ml-3">{showTerminal ? '关闭控制台' : '打开控制台'}</span>
            )}
          </button>
        )}

        {onToggleSkills && (
          <button
            onClick={onToggleSkills}
            className={`
              relative flex items-center w-full h-9 px-2 rounded-xl transition-all duration-150
              ${showSkills
                ? 'text-violet-600 bg-white/80 shadow-[0_2px_8px_-3px_rgba(139,92,246,0.3)] ring-1 ring-violet-100/60 font-medium'
                : 'text-slate-500 hover:text-violet-500 hover:bg-violet-50/50'
              }
            `}
            title={showSkills ? "关闭技能库" : "打开技能库"}
          >
            {showSkills && !collapsed && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-violet-500" />}
            <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            {!collapsed && (
              <span className="text-[13px] whitespace-nowrap ml-3">{showSkills ? '关闭技能库' : '打开技能库'}</span>
            )}
          </button>
        )}

        {onToggleKnowledge && (
          <button
            onClick={onToggleKnowledge}
            className={`
              relative flex items-center w-full h-9 px-2 rounded-xl transition-all duration-150
              ${showKnowledge
                ? 'text-amber-600 bg-white/80 shadow-[0_2px_8px_-3px_rgba(245,158,11,0.3)] ring-1 ring-amber-100/60 font-medium'
                : 'text-slate-500 hover:text-amber-500 hover:bg-amber-50/50'
              }
            `}
            title={showKnowledge ? "关闭知识库" : "打开知识库"}
          >
            {showKnowledge && !collapsed && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-amber-500" />}
            <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            {!collapsed && (
              <span className="text-[13px] whitespace-nowrap ml-3">{showKnowledge ? '关闭知识库' : '打开知识库'}</span>
            )}
          </button>
        )}
      </div>

      {/* Session List */}
      <div className={`
        flex-1 overflow-hidden transition-opacity duration-200
        ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100 delay-100'}
      `}>
        <div className="w-[240px] h-full overflow-y-auto px-2.5 pb-2.5 space-y-0.5">
        {/* Section label */}
        <div className="px-1 pt-0.5 pb-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">历史对话</span>
        </div>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin mb-2" />
            <span className="text-xs">加载中...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
             <svg className="w-10 h-10 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-[11px] text-slate-400">暂无对话记录</p>
          </div>
        ) : (
          sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={currentSessionId === session.id}
              isAgentRunning={!!isAgentRunning}
              isEditing={editingId === session.id}
              onSelect={() => onSelectSession(session.id)}
              onStartEdit={(e) => handleStartEdit(e, session)}
              onDelete={(e) => handleDelete(e, session)}
              editValue={editValue}
              onEditChange={setEditValue}
              onEditSave={handleSaveEdit}
              onEditCancel={() => setEditingId(null)}
              onEditKeyDown={handleKeyDown}
              editInputRef={editInputRef}
            />
          ))
        )}
        </div>
      </div>
    </motion.div>
  );
}
