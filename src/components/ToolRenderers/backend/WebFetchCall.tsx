import { ToolCallCard } from "../ToolCallCard";
import { ReadIcon } from "./_icons";
import { formatBytes } from "./_helpers";

export function WebFetchCall({
  args,
  result,
  animate,
}: {
  args: { url?: string; max_chars?: number };
  result?: {
    status?: string;
    message?: string;
    url?: string;
    markdown?: string;
    size?: number;
    truncated?: boolean;
    content_type?: string;
  };
  animate?: boolean;
}) {
  const status = result?.status === "success" ? "success" : result ? "error" : "loading";
  const preview = result?.markdown ? result.markdown.slice(0, 400) : "";

  return (
    <ToolCallCard
      title="抓取网页"
      icon={ReadIcon}
      status={status}
      animate={animate}
      headerExtra={
        <div className="flex items-center gap-2 min-w-0">
          <p className="truncate text-xs text-slate-500/90">{result?.url || args.url}</p>
          {result?.content_type && (
            <span className="flex-shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              {result.content_type}
            </span>
          )}
        </div>
      }
    >
      {status === "success" && (
        <p className="text-xs text-slate-500">
          {typeof result?.size === "number" ? `内容大小 ${formatBytes(result.size)}${result.truncated ? "（已截断）" : ""}` : "已完成抓取"}
        </p>
      )}
      {preview && (
        <pre className="mt-1 overflow-auto rounded-lg border border-slate-800/70 bg-slate-900/90 p-2.5 font-mono text-[11px] leading-relaxed text-slate-200 shadow-inner max-h-[180px]">
          {preview}
          {result?.markdown && result.markdown.length > preview.length ? "\n..." : ""}
        </pre>
      )}
      {result?.message && status === "error" && (
        <p className="mt-1 text-xs text-red-600">{result.message}</p>
      )}
    </ToolCallCard>
  );
}
