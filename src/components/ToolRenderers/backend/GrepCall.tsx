import { useState } from "react";
import { ToolCallCard } from "../ToolCallCard";
import { SearchIcon, FileInline } from "./_icons";
import { fileName } from "./_helpers";

const COLLAPSE_THRESHOLD = 10;

export function GrepCall({
  args,
  result,
  animate,
}: {
  args: { pattern?: string; path?: string; glob?: string; output_mode?: "files_with_matches" | "content" | "count" };
  result?: {
    status?: string;
    message?: string;
    files?: string[];
    counts?: Record<string, number>;
    matches?: Array<{ path: string; line: number; text?: string }>;
    output_mode?: "files_with_matches" | "content" | "count";
  };
  animate?: boolean;
}) {
  const status = result?.status === "success" ? "success" : result ? "error" : "loading";
  const mode = result?.output_mode || args.output_mode || "files_with_matches";

  const files = Array.isArray(result?.files) ? result.files : [];
  const matches = Array.isArray(result?.matches) ? result.matches : [];
  const countsEntries = result?.counts ? Object.entries(result.counts).sort((a, b) => b[1] - a[1]) : [];

  const totalMatches =
    mode === "count"
      ? countsEntries.reduce((s, [, c]) => s + c, 0)
      : mode === "content"
        ? matches.length
        : files.length;
  const totalFiles =
    mode === "count"
      ? countsEntries.length
      : mode === "content"
        ? new Set(matches.map((m) => m.path)).size
        : files.length;

  const [expanded, setExpanded] = useState(false);

  const modeLabel = { files_with_matches: "文件列表", content: "内容匹配", count: "计数" }[mode];

  return (
    <ToolCallCard
      title="文本搜索"
      icon={SearchIcon}
      status={status}
      animate={animate}
      headerExtra={
        <div className="flex items-center gap-2 min-w-0">
          <code className="truncate rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-600">
            {args.pattern || ""}
          </code>
          <span className="flex-shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {modeLabel}
          </span>
          {args.glob && (
            <span className="flex-shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-500 font-mono">
              {args.glob}
            </span>
          )}
          {args.path && (
            <span className="flex-shrink-0 truncate rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 font-mono">
              {args.path}
            </span>
          )}
          {status === "success" && totalMatches > 0 && (
            <span className="flex-shrink-0 text-[10px] text-slate-400">
              {totalMatches} 匹配 · {totalFiles} 文件
            </span>
          )}
        </div>
      }
    >
      {result?.message && status === "error" && (
        <p className="text-xs text-red-600">{result.message}</p>
      )}

      {/* files_with_matches */}
      {mode === "files_with_matches" && files.length > 0 && (
        <FileList paths={files} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
      )}

      {/* count — 带柱状条 */}
      {mode === "count" && countsEntries.length > 0 && (
        <div>
          <div className="max-h-52 overflow-y-auto rounded-lg border border-indigo-100/50 bg-white/50 p-1.5 text-xs">
            {(expanded ? countsEntries : countsEntries.slice(0, COLLAPSE_THRESHOLD)).map(([path, count]) => (
              <div key={path} className="flex items-center gap-2 rounded px-1.5 py-[3px] hover:bg-indigo-50/50 transition-colors">
                <FileInline />
                <span className="truncate font-mono text-slate-600 min-w-0 flex-1" title={path}>
                  {fileName(path)}
                </span>
                <span className="flex-shrink-0 text-[10px] font-medium text-slate-500 tabular-nums">{count}</span>
              </div>
            ))}
          </div>
          {countsEntries.length > COLLAPSE_THRESHOLD && (
            <ExpandButton expanded={expanded} total={countsEntries.length} onToggle={() => setExpanded((v) => !v)} />
          )}
        </div>
      )}

      {/* content — 按文件分组 */}
      {mode === "content" && matches.length > 0 && (
        <ContentMatches matches={matches} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
      )}

      {status === "success" && totalMatches === 0 && (
        <p className="text-xs text-slate-400 italic">未找到匹配结果</p>
      )}
    </ToolCallCard>
  );
}

/* ---------- sub-components ---------- */

function FileList({
  paths,
  expanded,
  onToggle,
}: {
  paths: string[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const display = expanded ? paths : paths.slice(0, COLLAPSE_THRESHOLD);
  return (
    <div>
      <div className="max-h-52 overflow-y-auto rounded-lg border border-indigo-100/50 bg-white/50 p-1.5 text-xs">
        {display.map((path, i) => (
          <div
            key={`${path}-${i}`}
            className="flex items-center gap-1.5 rounded px-1.5 py-[3px] hover:bg-indigo-50/50 transition-colors"
          >
            <FileInline />
            <span className="truncate font-mono text-slate-600" title={path}>
              {path}
            </span>
          </div>
        ))}
      </div>
      {paths.length > COLLAPSE_THRESHOLD && (
        <ExpandButton expanded={expanded} total={paths.length} onToggle={onToggle} />
      )}
    </div>
  );
}

function ContentMatches({
  matches,
  expanded,
  onToggle,
}: {
  matches: Array<{ path: string; line: number; text?: string }>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const limit = expanded ? 80 : 30;
  const display = matches.slice(0, limit);

  const groups: { path: string; items: typeof matches }[] = [];
  let currentGroup: (typeof groups)[number] | null = null;
  for (const m of display) {
    if (!currentGroup || currentGroup.path !== m.path) {
      currentGroup = { path: m.path, items: [] };
      groups.push(currentGroup);
    }
    currentGroup.items.push(m);
  }

  return (
    <div>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-indigo-100/50 bg-white/50 p-1.5 text-xs space-y-1">
        {groups.map((group) => (
          <div key={group.path}>
            <p className="truncate font-mono text-[10px] text-indigo-600 font-medium px-1.5 pt-1 pb-0.5" title={group.path}>
              {group.path}
            </p>
            {group.items.map((m, i) => (
              <div key={`${m.line}-${i}`} className="flex gap-2 rounded px-1.5 py-[2px] hover:bg-indigo-50/50 transition-colors">
                <span className="flex-shrink-0 text-[10px] text-slate-400 w-8 text-right font-mono tabular-nums">
                  {m.line}
                </span>
                {m.text && (
                  <span className="truncate text-[11px] text-slate-600 font-mono">{m.text}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      {matches.length > 30 && (
        <ExpandButton expanded={expanded} total={matches.length} onToggle={onToggle} />
      )}
    </div>
  );
}

function ExpandButton({
  expanded,
  total,
  onToggle,
}: {
  expanded: boolean;
  total: number;
  onToggle: () => void;
}) {
  return (
    <div className="flex justify-end mt-1">
      <button
        onClick={onToggle}
        className="text-[10px] text-indigo-500 hover:text-indigo-700 transition-colors"
      >
        {expanded ? "收起" : `展开全部 (${total})`}
      </button>
    </div>
  );
}
