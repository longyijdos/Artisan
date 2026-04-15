"use client";

import { createContext, useContext } from "react";
import type { SessionStore } from "@/lib/session/types";

export const SessionContext = createContext<SessionStore | null>(null);

export function useSessionContext(): SessionStore {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSessionContext must be used within a SessionProvider");
  }

  return context;
}
