import { ToolCallCard } from "../ToolCallCard";
import { ReadIcon } from "./_icons";
import { fileExt } from "./_helpers";

export function ReadFileCall({
  args,
  result,
  animate,
}: {
  args: { file_path: string; offset?: number; limit?: number };
  result?: {
    status?: string;
    message?: string;
    content?: string;
    offset?: number;
    limit?: number;
    total_lines?: number;
  };
  animate?: boolean;
}) {
  const status = result?.status === "success" ? "success" : result ? "error" : "loading";
  const ext = fileExt(args.file_path);
  const totalLines = typeof result?.total_lines === "number" ? result.total_lines : undefined;
  const readOffset = result?.offset ?? args.offset ?? 0;
  const readLimit = result?.limit ?? args.limit ?? 100;
  const readEnd = totalLines !== undefined ? Math.min(readOffset + readLimit, totalLines) : readOffset + readLimit;
  const hasRange = typeof args.offset === "number" || typeof args.limit === "number";

  return (
    <ToolCallCard
      title="读取文件"
      icon={ReadIcon}
      status={status}
      animate={animate}
      headerExtra={
        <div className="flex items-center gap-2 min-w-0">
          <p className="truncate font-mono text-xs text-slate-500/90" title={args.file_path}>
            {args.file_path}
          </p>
          {ext && (
            <span className="flex-shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-500 uppercase">
              {ext}
            </span>
          )}
        </div>
      }
    >
      {status === "success" && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              行 {readOffset + 1}–{readEnd}
              {typeof totalLines === "number" && <span className="text-slate-400"> / 共 {totalLines} 行</span>}
            </span>
            {!hasRange && typeof totalLines === "number" && readEnd < totalLines && (
              <span className="text-[10px] text-slate-400 font-medium">部分读取</span>
            )}
          </div>

          {typeof totalLines === "number" && totalLines > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-indigo-100/70 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-400/60 transition-all"
                  style={{
                    marginLeft: `${(readOffset / totalLines) * 100}%`,
                    width: `${Math.max(((readEnd - readOffset) / totalLines) * 100, 2)}%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-slate-400 flex-shrink-0 tabular-nums">
                {Math.round(((readEnd - readOffset) / totalLines) * 100)}%
              </span>
            </div>
          )}
        </div>
      )}
      {result?.message && status === "error" && (
        <p className="text-xs text-red-600">{result.message}</p>
      )}
    </ToolCallCard>
  );
}
