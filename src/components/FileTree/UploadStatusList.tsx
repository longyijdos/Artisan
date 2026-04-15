import { useEffect, useState, useCallback } from "react";
import type { UploadStatus } from "./types";
import { LoadingSpinner, CheckIcon, XIcon } from "./icons";

interface UploadStatusListProps {
  statuses: UploadStatus[];
  onClear: () => void;
}

export function UploadStatusList({ statuses, onClear }: UploadStatusListProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- animation state machine driven by effect */
  useEffect(() => {
    if (statuses.length > 0) {
      setShouldRender(true);
      // Use double RAF to ensure browser has painted the initial state
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      // Wait for fade out animation to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [statuses.length]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Handle manual close with animation
  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      onClear();
    }, 300);
  }, [onClear]);

  if (!shouldRender) return null;

  return (
    <div 
      className={`absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-sm rounded-2xl shadow-[0_10px_30px_-12px_rgba(79,70,229,0.3)] border border-indigo-100/60 px-4 py-3 transition-all duration-300 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500 font-medium">
          上传 {statuses.filter(s => s.status === "success").length}/{statuses.length}
        </span>
        <button
          onClick={handleClose}
          className="w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="关闭"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="space-y-1.5 max-h-28 overflow-y-auto">
        {statuses.map((status, idx) => (
          <div
            key={`${status.fileName}-${idx}`}
            className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg ${
              status.status === "success"
                ? "bg-emerald-50 text-emerald-700"
                : status.status === "error"
                ? "bg-red-50 text-red-700"
                : status.status === "uploading"
                ? "bg-indigo-50 text-indigo-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {status.status === "uploading" && (
              <LoadingSpinner className="w-3 h-3" />
            )}
            {status.status === "success" && <CheckIcon />}
            {status.status === "error" && <XIcon />}
            <span className="truncate flex-1">{status.fileName}</span>
            <span className="text-slate-400 truncate text-[10px]">→ /{status.targetPath || "root"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
