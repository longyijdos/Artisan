import { useState } from "react";
import { ToolCallCard } from "../ToolCallCard";
import { SearchIcon, FileInline } from "./_icons";
import { fileName } from "./_helpers";

const COLLAPSE_THRESHOLD = 12;

export function GlobCall({
  args,
  result,
  animate,
}: {
  args: { pattern?: string; path?: string };
  result?: {
    status?: string;
    message?: string;
    paths?: string[];
  };
  animate?: boolean;
}) {
  const status = result?.status === "success" ? "success" : result ? "error" : "loading";
  const paths = Array.isArray(result?.paths) ? result.paths : [];
  const [expanded, setExpanded] = useState(false);
  const isLong = paths.length > COLLAPSE_THRESHOLD;
  const displayPaths = isLong && !expanded ? paths.slice(0, COLLAPSE_THRESHOLD) : paths;

  return (
    <ToolCallCard
      title="文件匹配"
      icon={SearchIcon}
      status={status}
      animate={animate}
      headerExtra={
        <div className="flex items-center gap-2 min-w-0">
          <code className="truncate rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-600">
            {args.pattern || "*"}
          </code>
          {args.path && (
            <span className="flex-shrink-0 truncate rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 font-mono">
              {args.path}
            </span>
          )}
          {status === "success" && (
            <span className="flex-shrink-0 text-[10px] text-slate-400">
              {paths.length} 匹配
            </span>
          )}
        </div>
      }
    >
      {result?.message && status === "error" && (
        <p className="text-xs text-red-600">{result.message}</p>
      )}
      {paths.length > 0 && (
        <div>
          <div className="max-h-52 overflow-y-auto rounded-lg border border-indigo-100/50 bg-white/50 p-1.5 text-xs">
            {displayPaths.map((path, i) => {
              const name = fileName(path);
              const dir = path.slice(0, path.length - name.length);
              return (
                <div
                  key={`${path}-${i}`}
                  className="flex items-center gap-1.5 rounded px-1.5 py-[3px] hover:bg-indigo-50/50 transition-colors"
                >
                  <FileInline />
                  <span className="truncate font-mono">
                    {dir && <span className="text-slate-400">{dir}</span>}
                    <span className="text-slate-700 font-medium">{name}</span>
                  </span>
                </div>
              );
            })}
          </div>
          {isLong && (
            <div className="flex justify-end mt-1">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-[10px] text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                {expanded ? "收起" : `展开全部 (${paths.length})`}
              </button>
            </div>
          )}
        </div>
      )}
      {status === "success" && paths.length === 0 && (
        <p className="text-xs text-slate-400 italic">未找到匹配文件</p>
      )}
    </ToolCallCard>
  );
}
