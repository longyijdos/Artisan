"use client";

import { useEffect, useRef, useState } from "react";
import { useStickToBottom } from "use-stick-to-bottom";

export interface UseChatScrollReturn {
  scrollRef: React.RefCallback<HTMLElement>;
  contentRef: React.RefCallback<HTMLElement>;
  scrollToBottom: (options?: { animation?: "smooth" | "instant" }) => void;
  isAtBottom: boolean;
  composerHeight: number;
  composerRef: React.RefObject<HTMLFormElement | null>;
}

export function useChatScroll(): UseChatScrollReturn {
  const [composerHeight, setComposerHeight] = useState(84);
  const composerRef = useRef<HTMLFormElement | null>(null);

  const {
    scrollRef,
    contentRef,
    scrollToBottom,
    isAtBottom,
  } = useStickToBottom({
    initial: "instant",
    resize: "smooth",
  });

  // Track composer height via ResizeObserver
  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;

    const updateHeight = () => {
      setComposerHeight(Math.max(composer.offsetHeight, 72));
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(composer);
    return () => {
      observer.disconnect();
    };
  }, []);

  return {
    scrollRef,
    contentRef,
    scrollToBottom,
    isAtBottom,
    composerHeight,
    composerRef,
  };
}
