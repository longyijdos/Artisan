import type { SessionContract } from "./contracts";

export type Session = Omit<SessionContract, "lastUpdateTime"> & {
  lastUpdateTime: number;
  isAutoNamed?: boolean;
};

export interface SessionRenameOptions {
  isAuto?: boolean;
}

export interface SessionStore {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  loadSessions: () => Promise<void>;
  createSession: (title?: string) => Promise<Session | null>;
  deleteSession: (id: string) => Promise<boolean>;
  updateSessionTitle: (
    id: string,
    title: string,
    options?: SessionRenameOptions,
  ) => Promise<boolean>;
  autoNameSession: (message: string) => Promise<string | null>;
}
