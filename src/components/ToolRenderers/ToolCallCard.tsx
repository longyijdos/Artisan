import { ReactNode } from "react";
import { motion } from "framer-motion";

interface ToolCallCardProps {
  title: string;
  icon: ReactNode;
  status?: "success" | "error" | "loading" | "idle";
  animate?: boolean;
  children?: ReactNode;
  className?: string;
  headerExtra?: ReactNode;
}

export function ToolCallCard({
  title,
  icon,
  status = "idle",
  animate = true,
  children,
  className = "",
  headerExtra,
}: ToolCallCardProps) {
  const shouldAnimate = animate;
  const statusColor =
    status === "success"
      ? "text-emerald-700 bg-emerald-50/90 border-emerald-200"
      : status === "error"
      ? "text-red-700 bg-red-50/90 border-red-200"
      : status === "loading"
      ? "text-indigo-700 bg-indigo-50/90 border-indigo-200"
      : "text-slate-600 bg-slate-50/85 border-slate-200";

  const cardClassName = `tool-call-card group overflow-hidden rounded-2xl border border-indigo-100/80 bg-white/80 backdrop-blur-[1px] shadow-[0_10px_24px_-20px_rgba(79,70,229,0.55)] ${className}`;

  const content = (
    <>
      {/* Header */}
      <div className="relative flex items-center gap-3 bg-gradient-to-r from-indigo-50/65 via-white/70 to-transparent px-3 py-2.5">
        <div className={`p-2 rounded-lg ${statusColor} transition-colors`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="truncate text-sm font-medium text-slate-800">{title}</h4>
          {headerExtra && <div className="mt-0.5">{headerExtra}</div>}
        </div>
        <div className="flex items-center gap-2">
          {status === "success" && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50/90 px-2 py-0.5 text-xs font-medium text-emerald-700">成功</span>
          )}
          {status === "error" && (
            <span className="rounded-full border border-red-200 bg-red-50/90 px-2 py-0.5 text-xs font-medium text-red-700">失败</span>
          )}
          {status === "loading" && (
            <span
              className={`${shouldAnimate ? "animate-pulse " : ""}rounded-full border border-indigo-200 bg-indigo-50/90 px-2 py-0.5 text-xs font-medium text-indigo-700`}
            >
              执行中
            </span>
          )}
        </div>

        {status === "loading" && (
          <div className="pointer-events-none absolute bottom-0 left-3 right-3 h-[2px] overflow-hidden rounded-full bg-indigo-100/85">
            {shouldAnimate ? (
              <motion.span
                className="block h-full w-1/3 rounded-full bg-indigo-400/75"
                animate={{ x: ["-120%", "320%"] }}
                transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
              />
            ) : (
              <span className="block h-full w-1/3 rounded-full bg-indigo-400/75" />
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {children &&
        (shouldAnimate ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="border-t border-indigo-100/70 bg-gradient-to-b from-white/80 to-slate-50/70 p-3 text-sm"
          >
            {children}
          </motion.div>
        ) : (
          <div className="border-t border-indigo-100/70 bg-gradient-to-b from-white/80 to-slate-50/70 p-3 text-sm">
            {children}
          </div>
        ))}
    </>
  );

  if (!shouldAnimate) {
    return <div className={cardClassName}>{content}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cardClassName}
    >
      {content}
    </motion.div>
  );
}
