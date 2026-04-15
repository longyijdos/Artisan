import { ToolCallCard } from "../ToolCallCard";
import { ShellIcon } from "./_icons";

export function ShellCall({
  args,
  result,
  animate,
}: {
  args: { command: string };
  result?: { exit_code?: number; stdout?: string; stderr?: string; message?: string };
  animate?: boolean;
}) {
  const status =
    result?.exit_code === 0
      ? "success"
      : result?.exit_code !== undefined
      ? "error"
      : "loading";

  const hasOutput = Boolean(result?.stdout || result?.stderr);

  return (
    <ToolCallCard
      title="执行命令"
      icon={ShellIcon}
      status={status}
      animate={animate}
      headerExtra={
        <div className="flex items-center gap-2 min-w-0">
          <p className="truncate font-mono text-xs text-slate-500/90" title={args.command}>
            $ {args.command}
          </p>
          {result?.exit_code !== undefined && (
            <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono font-medium ${
              result.exit_code === 0
                ? "bg-emerald-50 text-emerald-600"
                : "bg-red-50 text-red-600"
            }`}>
              exit {result.exit_code}
            </span>
          )}
        </div>
      }
    >
      {hasOutput ? (
        <div className="space-y-2">
          {result!.stdout && (
            <div className="relative">
              <div className="absolute top-1.5 right-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold select-none">stdout</span>
              </div>
              <pre className="max-h-48 overflow-auto rounded-lg border border-slate-800/70 bg-slate-900/90 p-3 pr-14 font-mono text-xs leading-relaxed text-slate-200 shadow-inner">
                {result!.stdout}
              </pre>
            </div>
          )}
          {result!.stderr && (
            <div className="relative">
              <div className="absolute top-1.5 right-2">
                <span className="text-[10px] uppercase tracking-wider text-red-400 font-semibold select-none">stderr</span>
              </div>
              <pre className="max-h-48 overflow-auto rounded-lg border border-red-200/80 bg-red-50/70 p-3 pr-14 font-mono text-xs leading-relaxed text-red-700">
                {result!.stderr}
              </pre>
            </div>
          )}
        </div>
      ) : status !== "loading" && (
        <p className="text-xs text-slate-400 italic">无输出</p>
      )}
    </ToolCallCard>
  );
}
