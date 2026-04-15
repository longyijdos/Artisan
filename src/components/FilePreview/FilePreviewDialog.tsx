"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import { FileHeader } from "./FileHeader";
import { FileContentViewer } from "./FileContentViewer";
import { FileType } from "./utils";

interface FilePreviewDialogProps {
  filePath: string;
  content: string;
  fileType: FileType;
  filename: string;
  isDark: boolean;
  onToggleTheme: () => void;
  viewMode: "preview" | "code";
  onViewModeChange: (mode: "preview" | "code") => void;
  onClose: () => void;
}

export const FilePreviewDialog = memo(function FilePreviewDialog({
  filePath,
  content,
  fileType,
  filename,
  isDark,
  onToggleTheme,
  viewMode,
  onViewModeChange,
  onClose,
}: FilePreviewDialogProps) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
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
        className="relative w-full h-full max-w-5xl max-h-[85vh] bg-white/95 backdrop-blur-sm rounded-2xl shadow-[0_20px_44px_-30px_rgba(79,70,229,0.45)] border border-indigo-100/60 overflow-hidden z-10 flex flex-col"
      >
        {/* Header */}
        <FileHeader
          path={filePath}
          size={content.length}
          fileType={fileType}
          content={content}
          isDark={isDark}
          onToggleTheme={onToggleTheme}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          onClose={onClose}
        />

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <FileContentViewer
            content={content}
            filePath={filePath}
            fileType={fileType}
            filename={filename}
            isDark={isDark}
            viewMode={viewMode}
          />
        </div>
      </motion.div>
    </div>,
    document.body,
  );
});
