import { useEffect, useRef, useState } from "react";
import { ToolCallCard } from "../ToolCallCard";
import { WriteIcon } from "./_icons";
import { countLines, fileExt, formatBytes } from "./_helpers";

export function EditFileCall({
  args,
  result,
  animate,
}: {
  args: { file_path?: string; old_string?: string; new_string?: string; replace_all?: boolean };
  result?: {
    status?: string;
    message?: string;
    replacements?: number;
    available_matches?: number;
    size?: number;
  };
  animate?: boolean;
}) {
  const status = result?.status === "success" ? "success" : result ? "error" : "loading";
  const ext = args.file_path ? fileExt(args.file_path) : "";
  const oldText = typeof args.old_string === "string" ? args.old_string : "";
  const newText = typeof args.new_string === "string" ? args.new_string : "";
  const hasOldText = oldText.length > 0;
  const hasNewText = newText.length > 0;
  const oldLines = typeof args.old_string === "string" ? countLines(args.old_string) : 0;
  const newLines = typeof args.new_string === "string" ? countLines(args.new_string) : 0;
  const lineDiff = newLines - oldLines;
  const oldRef = useRef<HTMLPreElement>(null);
  const newRef = useRef<HTMLPreElement>(null);
  const [expanded, setExpanded] = useState(false);
  const isLong = oldLines > 8 || newLines > 8;

  useEffect(() => {
    if (status !== "loading") return;
    if (oldRef.current) oldRef.current.scrollTop = oldRef.current.scrollHeight;
    if (newRef.current) newRef.current.scrollTop = newRef.current.scrollHeight;
  }, [oldText, newText, status]);

  return (
    <ToolCallCard
      title="编辑文件"
      icon={WriteIcon}
      status={status}
      animate={animate}
      headerExtra={
        <div className="flex items-center gap-2 min-w-0">
          <p className="truncate font-mono text-xs text-slate-500/90" title={args.file_path}>
            {args.file_path}
          </p>
          {ext && (
            <span className="flex-shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-500 uppercase">{ext}</span>
          )}
          <span className="flex-shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-500">
            {args.replace_all ? "替换全部" : "精确匹配"}
          </span>
        </div>
      }
    >
      <div className="space-y-2">
        {/* 统计信息行 */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400/60" />
            {oldLines} 行
          </span>
          <span className="text-slate-300">→</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
            {newLines} 行
          </span>
          {lineDiff !== 0 && (
            <span className={`text-[10px] font-medium ${lineDiff > 0 ? "text-slate-500" : "text-slate-500"}`}>
              {lineDiff > 0 ? `+${lineDiff}` : lineDiff}
            </span>
          )}
          {typeof result?.replacements === "number" && (
            <span className="text-[10px] text-slate-400">· 替换 {result.replacements} 处</span>
          )}
          {typeof result?.size === "number" && (
            <span className="text-[10px] text-slate-400">· {formatBytes(result.size)}</span>
          )}
        </div>

        {isLong && status !== "loading" && (
          <div className="flex justify-end">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] text-indigo-500 hover:text-indigo-700 transition-colors"
            >
              {expanded ? "收起" : "展开全部"}
            </button>
          </div>
        )}

        {hasOldText && (
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400/60" />
              <span className="text-[11px] font-medium text-slate-500">删除</span>
            </div>
            <pre
              ref={oldRef}
              className={`overflow-auto rounded-lg border border-slate-800/70 bg-slate-900/90 p-2.5 font-mono text-[11px] leading-relaxed text-red-200/80 shadow-inner ${
                isLong && !expanded && status !== "loading" ? "max-h-[110px]" : "max-h-[260px]"
              }`}
            >
              {oldText}
            </pre>
          </div>
        )}

        {hasNewText && (
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
              <span className="text-[11px] font-medium text-slate-500">插入</span>
            </div>
            <pre
              ref={newRef}
              className={`overflow-auto rounded-lg border border-slate-800/70 bg-slate-900/90 p-2.5 font-mono text-[11px] leading-relaxed text-emerald-200/80 shadow-inner ${
                isLong && !expanded && status !== "loading" ? "max-h-[110px]" : "max-h-[260px]"
              }`}
            >
              {newText}
            </pre>
          </div>
        )}
      </div>

      {result?.message && status === "error" && (
        <p className="mt-1 text-xs text-red-600">{result.message}</p>
      )}
    </ToolCallCard>
  );
}
