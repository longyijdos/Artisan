import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import type { Skill } from "./SkillsLibrary";

interface SkillDetailDialogProps {
  skill: Skill;
  onClose: () => void;
}

export function SkillDetailDialog({ skill, onClose }: SkillDetailDialogProps) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-2xl shadow-[0_20px_44px_-30px_rgba(79,70,229,0.45)] border border-indigo-100/60 overflow-hidden z-10"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-indigo-100/40 flex items-center justify-between bg-white/70 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center
              ${skill.status === 'installed' ? 'bg-indigo-100/80 text-indigo-600' : 
                skill.status === 'core' ? 'bg-blue-100/80 text-blue-600' : 'bg-slate-100/80 text-slate-500'}
            `}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{skill.name}</h3>
              <div className="flex items-center gap-2">
                {skill.status === 'core' && (
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded-full">核心技能</span>
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
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 transition-colors rounded-full"
            title="关闭"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="prose prose-sm prose-slate max-w-none text-slate-600">
                <h4 className="text-sm font-semibold text-slate-900 mb-2">技能描述</h4>
                <p className="whitespace-pre-wrap leading-relaxed">
                  {skill.description || "该技能暂无详细描述。"}
                </p>
                
                {/* 可以在这里预留更多信息的展示位置，例如作者、版本、依赖等 */}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-white/50 backdrop-blur-sm border-t border-indigo-100/40 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white/90 border border-indigo-200/60 hover:bg-indigo-50/60 rounded-xl shadow-sm transition-colors"
              >
                关闭
              </button>
            </div>
          </motion.div>
    </div>,
    document.body,
  );
}
