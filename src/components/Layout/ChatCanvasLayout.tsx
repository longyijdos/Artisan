"use client";

import { useState, useRef, useEffect, ReactNode, memo } from "react";
import { motion } from "framer-motion";

export interface ChatCanvasLayoutProps {
  chatPanel: ReactNode;
  rightPanel: ReactNode;
  showRight: boolean;
  rightWidth?: number;
  rightPanelDark?: boolean;
  /** Title displayed in the top header bar */
  title?: string;
}

const ANIM_SPEED = 2800;
const ANIM_MIN = 0.15;
const ANIM_MAX = 0.3;
const PANEL_GAP = 12;
const HEADER_HEIGHT = 40;
const BOTTOM_PAD = 20;

function animDur(dist: number) {
  if (dist <= 0) return ANIM_MIN;
  return Math.min(ANIM_MAX, Math.max(ANIM_MIN, dist / ANIM_SPEED));
}

export const ChatCanvasLayout = memo(function ChatCanvasLayout({
  chatPanel,
  rightPanel,
  showRight = false,
  rightWidth = 700,
  rightPanelDark = false,
  title,
}: ChatCanvasLayoutProps) {
  const [displayedRight, setDisplayedRight] = useState(rightPanel);

  const rightTarget = showRight ? rightWidth : 0;
  const prevTarget = useRef(rightTarget);
  const [dur, setDur] = useState(ANIM_MIN);

  useEffect(() => {
    setDur(animDur(Math.abs(rightTarget - prevTarget.current)));
    prevTarget.current = rightTarget;
  }, [rightTarget]);

  /* eslint-disable react-hooks/set-state-in-effect -- intentional cache update */
  useEffect(() => {
    if (showRight) {
      setDisplayedRight(rightPanel);
    } else {
      setDisplayedRight(rightPanel);
      const timer = setTimeout(() => setDisplayedRight(null), dur * 1000 + 50);
      return () => clearTimeout(timer);
    }
  }, [showRight, rightPanel, dur]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const rightSpace = showRight ? rightWidth + PANEL_GAP * 2 : 0;
  const transition = { duration: dur, ease: "easeOut" as const };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[radial-gradient(120%_120%_at_50%_-10%,#eef2ff_0%,#f7f8fc_58%,#f5f7fb_100%)] flex flex-col">
      {/* ── Top header bar ── */}
      <div
        className="flex-shrink-0 flex items-center px-6 z-30"
        style={{ height: HEADER_HEIGHT }}
      >
        <motion.div
          initial={false}
          animate={{ paddingRight: rightSpace }}
          transition={transition}
          className="flex-1 min-w-0"
        >
          <h1 className="text-[15px] font-semibold text-slate-700 truncate">
            {title || "新对话"}
          </h1>
        </motion.div>
      </div>

      {/* ── Content area (below header) ── */}
      <div className="flex-1 min-h-0 relative">
        {/* Canvas content: chat */}
        <motion.div
          initial={false}
          animate={{ paddingRight: rightSpace }}
          transition={transition}
          className="h-full flex flex-col"
        >
          <div className="flex-1 min-h-0 overflow-hidden">
            {chatPanel}
          </div>
        </motion.div>

        {/* Right panel: floating card */}
        <motion.div
          initial={false}
          animate={{
            x: showRight ? 0 : rightWidth + PANEL_GAP * 2,
            opacity: showRight ? 1 : 0,
          }}
          transition={transition}
          style={{
            width: rightWidth + PANEL_GAP * 2,
            paddingLeft: PANEL_GAP,
            paddingRight: PANEL_GAP,
            paddingTop: 0,
            paddingBottom: BOTTOM_PAD,
          }}
          className="absolute top-0 right-0 h-full z-20"
        >
          <div
            className={`h-full overflow-hidden relative rounded-2xl border shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08),0_2px_12px_-4px_rgba(0,0,0,0.04)] ${
              rightPanelDark
                ? 'bg-slate-900 border-slate-700/60'
                : 'bg-white/95 backdrop-blur-sm border-indigo-100/50'
            }`}
          >
            {displayedRight}
          </div>
        </motion.div>
      </div>
    </div>
  );
});
