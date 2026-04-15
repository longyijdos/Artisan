import { ToolCallCard } from "../ToolCallCard";
import { SearchIcon } from "./_icons";

export function WebSearchCall({
  args,
  result,
  animate,
}: {
  args: { query: string; max_results?: number; summarize?: boolean; topic?: string };
  result?: {
    status?: string;
    message?: string;
    results?: Array<{ url: string; title: string; snippet?: string }>;
    summary?: string;
    sources?: Array<{ url: string; title: string }>;
    summarize?: boolean;
    topic?: string;
  };
  animate?: boolean;
}) {
  const status = result?.status === "success" ? "success" : result ? "error" : "loading";
  const results = result?.results || [];
  const sources = result?.sources || [];
  const summarize = result?.summarize ?? args.summarize ?? false;
  const topic = result?.topic || args.topic;

  return (
    <ToolCallCard
      title="网络搜索"
      icon={SearchIcon}
      status={status}
      animate={animate}
      headerExtra={
        <div className="flex items-center gap-2 min-w-0">
          <p className="truncate text-xs text-slate-500/90">&ldquo;{args.query}&rdquo;</p>
          {topic && (
            <span className="flex-shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-500">{topic}</span>
          )}
          {summarize && result?.summary && (
            <span className="flex-shrink-0 text-[10px] text-slate-400">{sources.length} 来源</span>
          )}
          {!summarize && results.length > 0 && (
            <span className="flex-shrink-0 text-[10px] text-slate-400">{results.length} 条结果</span>
          )}
        </div>
      }
    >
      {result?.message && status === "error" && (
        <p className="text-xs text-red-600">{result.message}</p>
      )}
      {summarize && (result?.summary || sources.length > 0) && (
        <div className="space-y-2.5">
          {result?.summary ? (
            <div className="whitespace-pre-wrap rounded-lg border border-indigo-100/70 bg-white/60 p-2.5 text-[13px] leading-relaxed text-slate-700">
              {result.summary}
            </div>
          ) : (
            <p className="text-xs text-slate-500">未生成摘要，已返回来源列表。</p>
          )}
          {sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sources.map((r, i) => (
                <a
                  key={i}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-indigo-100/60 bg-white/70 px-2.5 py-1 text-[11px] text-indigo-600 transition-colors hover:bg-indigo-50 hover:border-indigo-200"
                  title={r.url}
                >
                  <svg className="w-3 h-3 flex-shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span className="truncate max-w-[180px]">{r.title}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
      {!summarize && results.length > 0 && (
        <div className="space-y-1">
          {results.slice(0, 5).map((r, i) => (
            <div key={i} className="rounded-lg border border-indigo-100/50 bg-white/50 px-2.5 py-2">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors leading-snug"
                title={r.url}
              >
                <span className="truncate">{r.title}</span>
                <svg className="w-3 h-3 flex-shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              {r.snippet && (
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 line-clamp-2">{r.snippet}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </ToolCallCard>
  );
}
