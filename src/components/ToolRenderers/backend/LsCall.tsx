import { ToolCallCard } from "../ToolCallCard";
import { ListIcon, FileInline, DirInline } from "./_icons";
import { isDirectory, fileName } from "./_helpers";

export function LsCall({
  args,
  result,
  animate,
}: {
  args: { path?: string };
  result?: {
    status?: string;
    message?: string;
    paths?: string[];
  };
  animate?: boolean;
}) {
  const status = result?.status === "success" ? "success" : result ? "error" : "loading";
  const basePath = args.path || ".";
  const paths = Array.isArray(result?.paths) ? result.paths : [];
  const dirs = paths.filter(isDirectory);
  const files = paths.filter((p) => !isDirectory(p));

  return (
    <ToolCallCard
      title="列出目录"
      icon={ListIcon}
      status={status}
      animate={animate}
      headerExtra={
        <div className="flex items-center gap-2 min-w-0">
          <p className="truncate font-mono text-xs text-slate-500/90">{basePath}</p>
          {status === "success" && (
            <span className="flex-shrink-0 text-[10px] text-slate-400">
              {dirs.length} 目录 · {files.length} 文件
            </span>
          )}
        </div>
      }
    >
      {result?.message && status === "error" && (
        <p className="text-xs text-red-600">{result.message}</p>
      )}
      {paths.length > 0 && (
        <div className="max-h-52 overflow-y-auto rounded-lg border border-indigo-100/50 bg-white/50 p-1.5 text-xs">
          {paths.map((path, i) => {
            const isDir = isDirectory(path);
            const name = fileName(path);
            return (
              <div
                key={`${path}-${i}`}
                className="flex items-center gap-1.5 rounded px-1.5 py-[3px] hover:bg-indigo-50/50 transition-colors"
              >
                {isDir ? <DirInline /> : <FileInline />}
                <span className={`truncate font-mono ${isDir ? "text-slate-700 font-medium" : "text-slate-600"}`}>
                  {name}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </ToolCallCard>
  );
}
