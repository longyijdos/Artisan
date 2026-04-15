import { useEffect, useRef, useState } from "react";
import { ToolCallCard } from "../ToolCallCard";
import { WriteIcon } from "./_icons";
import { fileExt, formatBytes, countLines } from "./_helpers";

export function WriteFileCall({
  args,
  result,
  animate,
}: {
  args: { file_path?: string; content?: string };
  result?: {
    status?: string;
    message?: string;
    size?: number;
  };
  animate?: boolean;
}) {
  const status = result?.status === "success" ? "success" : result ? "error" : "loading";
  const content = args.content;
  const hasContent = typeof content === "string" && content.length > 0;
  const preRef = useRef<HTMLPreElement>(null);
  const [expanded, setExpanded] = useState(false);
  const lines = hasContent ? countLines(content!) : 0;
  const isLong = lines > 12;

  useEffect(() => {
    const el = preRef.current;
    if (el && status === "loading") {
      el.scrollTop = el.scrollHeight;
    }
  }, [content, status]);

  const ext = args.file_path ? fileExt(args.file_path) : "";

  return (
    <ToolCallCard
      title="写入文件"
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
        </div>
      }
    >
      {hasContent && (
        <div className="relative">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-400">
              {lines} 行{result?.size ? ` · ${formatBytes(result.size)}` : ""}
            </span>
            {isLong && status !== "loading" && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[10px] text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                {expanded ? "收起" : "展开全部"}
              </button>
            )}
          </div>
          <pre
            ref={preRef}
            className={`overflow-auto rounded-lg border border-slate-800/70 bg-slate-900/90 p-3 font-mono text-xs leading-relaxed text-slate-200 shadow-inner ${
              isLong && !expanded && status !== "loading" ? "max-h-[180px]" : "max-h-[400px]"
            }`}
          >
            {content}
          </pre>
          {isLong && !expanded && status !== "loading" && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 rounded-b-lg bg-gradient-to-t from-slate-900/90 to-transparent" />
          )}
        </div>
      )}
      {result?.message && status === "error" && (
        <p className="mt-2 text-xs text-red-600">{result.message}</p>
      )}
    </ToolCallCard>
  );
}
