"use client";

import { useState, useEffect, useCallback } from "react";
import {
  autoNameSessionRequest,
  createSessionRequest,
  deleteSessionRequest,
  fetchSessionsRequest,
  updateSessionTitleRequest,
} from "@/lib/session/api";
import type {
  Session,
  SessionRenameOptions,
  SessionStore,
} from "@/lib/session/types";
import type { SessionContract } from "@/lib/session/contracts";

export type { Session, SessionRenameOptions, SessionStore } from "@/lib/session/types";

function normalizeSession(session: SessionContract): Session {
  return {
    id: session.id,
    title: session.title,
    lastUpdateTime:
      typeof session.lastUpdateTime === "number"
        ? session.lastUpdateTime
        : Date.now() / 1000,
    ...(typeof session.createdAt === "number"
      ? { createdAt: session.createdAt }
      : {}),
  };
}

export function useSession(): SessionStore {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load sessions from API
  const loadSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { response, data } = await fetchSessionsRequest();
      
      if (!response.ok) {
        setError(data?.detail || "无法加载会话列表");
        setSessions([]);
      } else {
        const loadedSessions = (data?.sessions || []).map(normalizeSession);
        setSessions(loadedSessions);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
      setError("无法加载会话列表");
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a new session
  const createSession = useCallback(async (title?: string): Promise<Session | null> => {
    try {
      const { response, data } = await createSessionRequest(title);
      
      if (!response.ok) {
        setError(data?.detail || "无法创建新会话");
        return null;
      }
      
      const newSession = normalizeSession({
        id: data?.id ?? "",
        title: data?.title ?? "",
        lastUpdateTime: data?.lastUpdateTime ?? null,
      });
      
      // Add to sessions list
      setSessions(prev => [newSession, ...prev]);
      
      return newSession;
    } catch (err) {
      console.error("Failed to create session:", err);
      setError("无法创建新会话");
      return null;
    }
  }, []);

  // Delete a session
  const deleteSession = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { response } = await deleteSessionRequest(id);

      if (!response.ok) {
        return false;
      }
      
      setSessions(prev => prev.filter(s => s.id !== id));
      return true;
    } catch (err) {
      console.error("Failed to delete session:", err);
      setError("无法删除会话");
      return false;
    }
  }, []);

  // Update session title
  const updateSessionTitle = useCallback(async (
    id: string,
    title: string,
    options?: SessionRenameOptions,
  ): Promise<boolean> => {
    try {
      const { response } = await updateSessionTitleRequest(id, title);
      
      if (response.ok) {
        setSessions(prev => prev.map(s => 
          s.id === id ? { ...s, title, isAutoNamed: options?.isAuto } : s
        ));
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to update session:", err);
      return false;
    }

  }, []);

  // Auto-name session based on message
  const autoNameSession = useCallback(async (message: string): Promise<string | null> => {
    try {
      const { data } = await autoNameSessionRequest(message);
      return data?.title || null;
    } catch (err) {
      console.error("Failed to auto-name session:", err);
      return null;
    }
  }, []);

  // Initialize: load sessions
  useEffect(() => {
    const init = async () => {
      await loadSessions();
    };
    init();
  }, [loadSessions]);

  return {
    sessions,
    isLoading,
    error,
    loadSessions,
    createSession,
    deleteSession,
    updateSessionTitle,
    autoNameSession,
  };
}
