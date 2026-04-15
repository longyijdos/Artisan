import { ToolCallCard } from "../ToolCallCard";

const PlanIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5h10M9 12h10M9 19h10M5 6h.01M5 13h.01M5 20h.01"
    />
  </svg>
);

export function UpdatePlanCall({
  args,
  result,
  pending,
  animate,
}: {
  args: {
    explanation?: string;
    plan?: Array<{ step?: string; status?: string }>;
  };
  result?: { status?: string; explanation?: string; plan?: Array<{ step: string; status: string }> };
  pending?: boolean;
  animate?: boolean;
}) {
  const status = result?.status === "success" ? "success" : result ? "error" : "loading";

  // streaming — args still arriving, show loading card only
  if (pending) {
    return <ToolCallCard title="执行计划" icon={PlanIcon} status="loading" animate={animate} />;
  }
  const explanation = result?.explanation ?? args.explanation;
  const plan = (result?.plan ?? args.plan ?? []).filter(Boolean) as Array<{ step?: string; status?: string }>;

  const completedCount = plan.filter((s) => s.status === "completed").length;
  const totalCount = plan.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const stepIcon = (s?: string) => {
    if (s === "completed")
      return (
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    if (s === "in_progress")
      return (
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        </div>
      );
    return (
      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
      </div>
    );
  };

  const stepTextClass = (s?: string) => {
    if (s === "completed") return "text-slate-500 line-through decoration-slate-300";
    if (s === "in_progress") return "text-slate-800 font-medium";
    return "text-slate-600";
  };

  return (
    <ToolCallCard
      title="执行计划"
      icon={PlanIcon}
      status={status}
      animate={animate}
      headerExtra={
        totalCount > 0 ? (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-1 h-1.5 min-w-[60px] max-w-[120px] rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="flex-shrink-0 text-[10px] text-slate-400 tabular-nums">
              {completedCount}/{totalCount}
            </span>
          </div>
        ) : undefined
      }
    >
      {explanation && (
        <p className="text-[13px] leading-relaxed text-slate-600 mb-2.5">{explanation}</p>
      )}
      {plan.length > 0 && (
        <div className="space-y-0.5">
          {plan.map((item, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
                item.status === "in_progress" ? "bg-amber-50/50" : ""
              }`}
            >
              {/* Vertical timeline connector */}
              <div className="flex flex-col items-center">
                {stepIcon(item.status)}
                {i < plan.length - 1 && (
                  <div className={`w-px flex-1 min-h-[8px] mt-0.5 ${
                    item.status === "completed" ? "bg-emerald-200" : "bg-slate-200"
                  }`} />
                )}
              </div>
              <span className={`text-xs leading-relaxed pt-0.5 ${stepTextClass(item.status)}`}>
                {item.step}
              </span>
            </div>
          ))}
        </div>
      )}
    </ToolCallCard>
  );
}
