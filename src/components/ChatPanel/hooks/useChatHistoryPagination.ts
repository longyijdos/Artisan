"use client";

import { useEffect, useRef } from "react";

interface UseChatHistoryPaginationOptions {
  scrollContainer: HTMLDivElement | null;
  isHistoryLoading: boolean;
  isLoadingMoreHistory: boolean;
  hasMoreHistory: boolean;
  loadOlderHistory: () => Promise<boolean>;
}

export function useChatHistoryPagination({
  scrollContainer,
  isHistoryLoading,
  isLoadingMoreHistory,
  hasMoreHistory,
  loadOlderHistory,
}: UseChatHistoryPaginationOptions): void {
  const isLoadingOlderRef = useRef(false);

  useEffect(() => {
    if (!scrollContainer) return;

    const container = scrollContainer;
    const onScroll = () => {
      if (container.scrollTop > 120) {
        return;
      }
      if (isHistoryLoading || isLoadingMoreHistory || !hasMoreHistory || isLoadingOlderRef.current) {
        return;
      }

      isLoadingOlderRef.current = true;
      const prevTop = container.scrollTop;
      const prevHeight = container.scrollHeight;

      void loadOlderHistory()
        .then((loaded) => {
          if (!loaded) return;
          window.requestAnimationFrame(() => {
            const nextHeight = container.scrollHeight;
            const delta = nextHeight - prevHeight;
            if (delta > 0) {
              container.scrollTo({
                top: prevTop + delta,
                behavior: "auto",
              });
            }
          });
        })
        .finally(() => {
          isLoadingOlderRef.current = false;
        });
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
    };
  }, [
    hasMoreHistory,
    isHistoryLoading,
    isLoadingMoreHistory,
    loadOlderHistory,
    scrollContainer,
  ]);
}
