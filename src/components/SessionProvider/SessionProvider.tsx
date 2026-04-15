"use client";

import type { ReactNode } from "react";
import { ChatComposerFlowProvider } from "@/components/ChatComposerFlowProvider";
import { useSession } from "@/hooks/useSession";
import { SessionContext } from "./session-context";

export { useSessionContext } from "./session-context";

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const session = useSession();

  return (
    <SessionContext.Provider value={session}>
      <ChatComposerFlowProvider>
        {children}
      </ChatComposerFlowProvider>
    </SessionContext.Provider>
  );
}
