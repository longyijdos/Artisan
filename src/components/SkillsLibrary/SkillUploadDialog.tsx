"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import type { SkillUploadResponseContract } from "@/lib/skills/contracts";
import {
  type FileWithPath,
  type CollectedFiles,
  getFilesFromDataTransfer,
  hasSkillMd,
} from "./folderUtils";

interface SkillUploadDialogProps {
  sessionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type UploadState = "idle" | "uploading" | "success" | "error";

export function SkillUploadDialog({
  sessionId,
  onClose,
  onSuccess,
}: SkillUploadDialogProps) {
  const [files, setFiles] = useState<FileWithPath[]>([]);
  const [folderName, setFolderName] = useState("");
  const [skillName, setSkillName] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Set webkitdirectory imperatively to avoid TS JSX type error
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
    }
  }, []);

  // ---- Validate & set files -----------------------------------------------

  const acceptFiles = useCallback((collected: CollectedFiles) => {
    if (!hasSkillMd(collected.items)) {
      setErrorMessage("所选文件夹中未找到 SKILL.md 文件");
      setFiles([]);
      setFolderName("");
      return;
    }
    setFiles(collected.items);
    setFolderName(collected.folderName);
    setErrorMessage("");
  }, []);

  // ---- Folder picker ------------------------------------------------------

  const handleFolderInput = useCallback(
    (inputFiles: FileList | null) => {
      if (!inputFiles || inputFiles.length === 0) return;
      const items: FileWithPath[] = [];
      let extractedFolderName = "";
      for (let i = 0; i < inputFiles.length; i++) {
        const f = inputFiles[i];
        let relPath = f.webkitRelativePath || f.name;
        if (relPath.includes("/")) {
          if (!extractedFolderName) {
            extractedFolderName = relPath.split("/")[0];
          }
          relPath = relPath.split("/").slice(1).join("/");
        }
        items.push({ file: f, relativePath: relPath });
      }
      acceptFiles({ items, folderName: extractedFolderName });
    },
    [acceptFiles],
  );

  // ---- Drag & drop --------------------------------------------------------

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      // Extract dropped folder name
      let droppedFolderName = "";
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const entry = e.dataTransfer.items[i].webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          droppedFolderName = entry.name;
          break;
        }
      }

      try {
        const result = await getFilesFromDataTransfer(e.dataTransfer);
        if (result.length > 0) {
          acceptFiles({ items: result, folderName: droppedFolderName });
        }
      } catch {
        // Fallback: flat file list
        const fallback: FileWithPath[] = [];
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const f = e.dataTransfer.files[i];
          fallback.push({ file: f, relativePath: f.name });
        }
        if (fallback.length > 0) {
          acceptFiles({ items: fallback, folderName: droppedFolderName });
        }
      }
    },
    [acceptFiles],
  );

  // ---- Upload -------------------------------------------------------------

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploadState("uploading");
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("thread_id", sessionId);
      if (skillName.trim()) {
        formData.append("skill_name", skillName.trim());
      }
      if (folderName) {
        formData.append("folder_name", folderName);
      }
      for (const { file, relativePath } of files) {
        formData.append("files", file, relativePath);
      }

      const response = await fetch("/api/skills/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as SkillUploadResponseContract;

      if (!response.ok || !data.success) {
        throw new Error(data.detail || data.message || "Upload failed");
      }

      setUploadState("success");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err) {
      setUploadState("error");
      setErrorMessage(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const safeClose = () => {
    if (uploadState !== "uploading") onClose();
  };

  // ---- Render -------------------------------------------------------------

  const content = (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={safeClose} />

      <motion.div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-indigo-100/60"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-indigo-100/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-700">上传技能</h2>
          </div>
          <button onClick={safeClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Skill name */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              技能名称 <span className="text-slate-400">(可选，自动从 SKILL.md 提取)</span>
            </label>
            <input
              type="text"
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              placeholder="my-custom-skill"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-colors"
            />
          </div>

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => folderInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
              ${isDragging
                ? "border-indigo-400 bg-indigo-50/60"
                : "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30"
              }
            `}
          >
            <input
              ref={folderInputRef}
              type="file"
              onChange={(e) => handleFolderInput(e.target.files)}
              className="hidden"
            />

            <svg className="w-8 h-8 mx-auto mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-sm text-slate-500">
              拖拽文件夹到此处，或 <span className="text-indigo-600 font-medium">点击选择文件夹</span>
            </p>
            <p className="text-xs text-slate-400 mt-1.5">文件夹中须包含 SKILL.md</p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500 font-medium">
                  已选择 {files.length} 个文件
                </span>
                <button
                  onClick={() => setFiles([])}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                >
                  清空
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {files.map((f, i) => (
                  <div
                    key={`${f.relativePath}-${i}`}
                    className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="truncate text-slate-600 text-xs">{f.relativePath}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {(f.file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      className="p-0.5 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {errorMessage && (
            <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{errorMessage}</div>
          )}

          {/* Success */}
          {uploadState === "success" && (
            <div className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
              上传成功！技能已自动安装。
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-indigo-100/40 flex justify-end gap-2">
          <button
            onClick={safeClose}
            disabled={uploadState === "uploading"}
            className={`px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors ${
              uploadState === "uploading" ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            取消
          </button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploadState === "uploading" || uploadState === "success"}
            className={`
              px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors
              shadow-[0_4px_12px_-4px_rgba(79,70,229,0.4)]
              ${files.length === 0 || uploadState === "uploading" || uploadState === "success"
                ? "bg-indigo-300 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-500"
              }
            `}
          >
            {uploadState === "uploading" ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                上传中...
              </span>
            ) : uploadState === "success" ? "已完成" : "上传"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(<AnimatePresence>{content}</AnimatePresence>, document.body);
}
