import { ToolCallCard } from "../ToolCallCard";
import { SkillIcon } from "./_icons";

export function ActivateSkillCall({
  args,
  result,
  animate,
}: {
  args: { skill_name: string };
  result?: { status?: string; skill_name?: string; description?: string; message?: string; skill_guide?: string };
  animate?: boolean;
}) {
  const status = result?.status === "success" ? "success" : result ? "error" : "loading";

  return (
    <ToolCallCard
      title="激活技能"
      icon={SkillIcon}
      status={status}
      animate={animate}
      headerExtra={
        <div className="flex items-center gap-2 min-w-0">
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">{args.skill_name}</span>
        </div>
      }
    >
      {result?.description && (
        <p className="text-[13px] leading-relaxed text-slate-600">{result.description}</p>
      )}
      {result?.message && status === "error" && (
        <p className="text-xs text-red-600">{result.message}</p>
      )}
    </ToolCallCard>
  );
}
