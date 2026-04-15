"use client";

import { useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import type { Session } from "@/lib/session/types";

export function toSessionPath(sessionId: string): string {
  return `/${encodeURIComponent(sessionId)}`;
}

interface UseRouteSessionStateOptions {
  sessions: Session[];
  isSessionLoading: boolean;
  sessionError: string | null;
}

interface UseRouteSessionStateReturn {
  currentSessionId: string | null;
  hasSelectedSession: boolean;
}

export function useRouteSessionState({
  sessions,
  isSessionLoading,
  sessionError,
}: UseRouteSessionStateOptions): UseRouteSessionStateReturn {
  const params = useParams<{ sessionId?: string | string[] }>();
  const router = useRouter();
  const { showToast } = useToast();

  const routeSessionSegments = useMemo(() => {
    const raw = params?.sessionId;
    if (Array.isArray(raw)) {
      return raw;
    }
    if (typeof raw === "string") {
      return [raw];
    }
    return [];
  }, [params]);

  const hasInvalidSessionPath = routeSessionSegments.length > 1;
  const currentSessionId = useMemo(() => {
    if (routeSessionSegments.length !== 1) {
      return null;
    }

    const onlySegment = routeSessionSegments[0];
    return typeof onlySegment === "string" && onlySegment.trim().length > 0
      ? onlySegment
      : null;
  }, [routeSessionSegments]);

  const invalidPathHandledRef = useRef(false);
  const invalidSessionHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasInvalidSessionPath) {
      invalidPathHandledRef.current = false;
      return;
    }
    if (invalidPathHandledRef.current) {
      return;
    }

    invalidPathHandledRef.current = true;
    showToast("warning", "无效会话路径");
    router.replace("/");
  }, [hasInvalidSessionPath, router, showToast]);

  useEffect(() => {
    if (!currentSessionId) {
      invalidSessionHandledRef.current = null;
      return;
    }
    if (isSessionLoading || sessionError) {
      return;
    }

    const sessionExists = sessions.some((session) => session.id === currentSessionId);
    if (sessionExists) {
      invalidSessionHandledRef.current = null;
      return;
    }
    if (invalidSessionHandledRef.current === currentSessionId) {
      return;
    }

    invalidSessionHandledRef.current = currentSessionId;
    showToast("warning", "当前会话不存在或已删除");
    router.replace("/");
  }, [
    currentSessionId,
    isSessionLoading,
    router,
    sessionError,
    sessions,
    showToast,
  ]);

  return {
    currentSessionId,
    hasSelectedSession: Boolean(currentSessionId),
  };
}
