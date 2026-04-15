"use client";

import { createContext, useContext, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

const MAX_AGE_MS = 120_000;

export interface PendingAttachmentEntry {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType?: string;
}

export interface PendingSessionMessage {
  message: string;
  reasoningMode: boolean;
  attachments: PendingAttachmentEntry[];
  knowledgeSourceIds: number[];
}

interface StoredPendingSessionMessage extends PendingSessionMessage {
  expiresAt: number;
}

interface PendingUploadFilesEntry {
  files: File[];
  expiresAt: number;
}

interface ChatComposerFlowState {
  sharedInput: string;
  reasoningEnabled: boolean;
  selectedKnowledgeIds: number[];
  pendingMessagesByThreadId: Record<string, StoredPendingSessionMessage>;
  pendingUploadFilesByThreadId: Record<string, PendingUploadFilesEntry>;
}

interface ChatComposerFlowStore {
  subscribe: (listener: () => void) => () => void;
  getSharedInput: () => string;
  setSharedInput: (value: string) => void;
  getReasoningEnabled: () => boolean;
  setReasoningEnabled: (value: boolean) => void;
  getSelectedKnowledgeIds: () => number[];
  setSelectedKnowledgeIds: (ids: number[]) => void;
  setPendingSessionMessage: (
    threadId: string,
    message: string,
    reasoningMode?: boolean,
    attachments?: PendingAttachmentEntry[],
    knowledgeSourceIds?: number[],
  ) => void;
  consumePendingSessionMessage: (threadId: string) => PendingSessionMessage | null;
  setPendingUploadFiles: (threadId: string, files: File[]) => void;
  consumePendingUploadFiles: (threadId: string) => File[] | null;
}

const EMPTY_SERVER_INPUT = "";
const EMPTY_KNOWLEDGE_IDS: number[] = [];

const initialState: ChatComposerFlowState = {
  sharedInput: "",
  reasoningEnabled: false,
  selectedKnowledgeIds: [],
  pendingMessagesByThreadId: {},
  pendingUploadFilesByThreadId: {},
};

function pruneExpiredEntries(state: ChatComposerFlowState, now: number): ChatComposerFlowState {
  let pendingMessagesByThreadId = state.pendingMessagesByThreadId;
  let pendingUploadFilesByThreadId = state.pendingUploadFilesByThreadId;
  let hasMessageChanges = false;
  let hasUploadChanges = false;

  for (const [threadId, entry] of Object.entries(state.pendingMessagesByThreadId)) {
    if (entry.expiresAt > now) continue;
    if (!hasMessageChanges) {
      pendingMessagesByThreadId = { ...pendingMessagesByThreadId };
      hasMessageChanges = true;
    }
    delete pendingMessagesByThreadId[threadId];
  }

  for (const [threadId, entry] of Object.entries(state.pendingUploadFilesByThreadId)) {
    if (entry.expiresAt > now) continue;
    if (!hasUploadChanges) {
      pendingUploadFilesByThreadId = { ...pendingUploadFilesByThreadId };
      hasUploadChanges = true;
    }
    delete pendingUploadFilesByThreadId[threadId];
  }

  if (!hasMessageChanges && !hasUploadChanges) {
    return state;
  }

  return {
    ...state,
    pendingMessagesByThreadId,
    pendingUploadFilesByThreadId,
  };
}

function createChatComposerFlowStore(): ChatComposerFlowStore {
  let state = initialState;
  const listeners = new Set<() => void>();

  const emitChange = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const commitState = (nextState: ChatComposerFlowState) => {
    if (nextState === state) return;
    state = nextState;
    emitChange();
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSharedInput: () => state.sharedInput,
    setSharedInput: (value) => {
      if (value === state.sharedInput) return;
      commitState({
        ...state,
        sharedInput: value,
      });
    },
    getReasoningEnabled: () => state.reasoningEnabled,
    setReasoningEnabled: (value) => {
      if (value === state.reasoningEnabled) return;
      commitState({
        ...state,
        reasoningEnabled: value,
      });
    },
    getSelectedKnowledgeIds: () => state.selectedKnowledgeIds,
    setSelectedKnowledgeIds: (ids) => {
      commitState({
        ...state,
        selectedKnowledgeIds: ids,
      });
    },
    setPendingSessionMessage: (threadId, message, reasoningMode = false, attachments = [], knowledgeSourceIds = []) => {
      if (!threadId) return;
      const trimmedMessage = message.trim();
      if (!trimmedMessage) return;

      const now = Date.now();
      const nextState = pruneExpiredEntries(state, now);
      commitState({
        ...nextState,
        pendingMessagesByThreadId: {
          ...nextState.pendingMessagesByThreadId,
          [threadId]: {
            message: trimmedMessage,
            reasoningMode,
            attachments: [...attachments],
            knowledgeSourceIds: [...knowledgeSourceIds],
            expiresAt: now + MAX_AGE_MS,
          },
        },
      });
    },
    consumePendingSessionMessage: (threadId) => {
      if (!threadId) return null;

      const now = Date.now();
      const nextState = pruneExpiredEntries(state, now);
      const entry = nextState.pendingMessagesByThreadId[threadId];

      if (!entry) {
        commitState(nextState);
        return null;
      }

      const pendingEntry: PendingSessionMessage = {
        message: entry.message,
        reasoningMode: entry.reasoningMode,
        attachments: [...entry.attachments],
        knowledgeSourceIds: [...(entry.knowledgeSourceIds || [])],
      };
      const pendingMessagesByThreadId = { ...nextState.pendingMessagesByThreadId };
      delete pendingMessagesByThreadId[threadId];

      commitState({
        ...nextState,
        pendingMessagesByThreadId,
      });

      return pendingEntry;
    },
    setPendingUploadFiles: (threadId, files) => {
      if (!threadId) return;

      const now = Date.now();
      const nextState = pruneExpiredEntries(state, now);

      if (!files.length) {
        if (!(threadId in nextState.pendingUploadFilesByThreadId)) {
          commitState(nextState);
          return;
        }
        const pendingUploadFilesByThreadId = { ...nextState.pendingUploadFilesByThreadId };
        delete pendingUploadFilesByThreadId[threadId];
        commitState({
          ...nextState,
          pendingUploadFilesByThreadId,
        });
        return;
      }

      commitState({
        ...nextState,
        pendingUploadFilesByThreadId: {
          ...nextState.pendingUploadFilesByThreadId,
          [threadId]: {
            files: [...files],
            expiresAt: now + MAX_AGE_MS,
          },
        },
      });
    },
    consumePendingUploadFiles: (threadId) => {
      if (!threadId) return null;

      const now = Date.now();
      const nextState = pruneExpiredEntries(state, now);
      const entry = nextState.pendingUploadFilesByThreadId[threadId];

      if (!entry || entry.files.length === 0) {
        commitState(nextState);
        return null;
      }

      const pendingUploadFilesByThreadId = { ...nextState.pendingUploadFilesByThreadId };
      delete pendingUploadFilesByThreadId[threadId];

      commitState({
        ...nextState,
        pendingUploadFilesByThreadId,
      });

      return [...entry.files];
    },
  };
}

const ChatComposerFlowContext = createContext<ChatComposerFlowStore | null>(null);

function useChatComposerFlowStore(): ChatComposerFlowStore {
  const store = useContext(ChatComposerFlowContext);
  if (!store) {
    throw new Error("useChatComposerFlow must be used within a ChatComposerFlowProvider");
  }
  return store;
}

export function ChatComposerFlowProvider({ children }: { children: ReactNode }) {
  const [store] = useState<ChatComposerFlowStore>(createChatComposerFlowStore);

  return (
    <ChatComposerFlowContext.Provider value={store}>
      {children}
    </ChatComposerFlowContext.Provider>
  );
}

export function useSharedComposerInput(): readonly [string, (value: string) => void] {
  const store = useChatComposerFlowStore();
  const sharedInput = useSyncExternalStore(
    store.subscribe,
    store.getSharedInput,
    () => EMPTY_SERVER_INPUT,
  );

  return [sharedInput, store.setSharedInput] as const;
}

export function useSharedReasoningEnabled(): readonly [boolean, (value: boolean) => void] {
  const store = useChatComposerFlowStore();
  const reasoningEnabled = useSyncExternalStore(
    store.subscribe,
    store.getReasoningEnabled,
    () => false,
  );

  return [reasoningEnabled, store.setReasoningEnabled] as const;
}

export function useSharedSelectedKnowledgeIds(): readonly [number[], (ids: number[]) => void] {
  const store = useChatComposerFlowStore();
  const selectedKnowledgeIds = useSyncExternalStore(
    store.subscribe,
    store.getSelectedKnowledgeIds,
    () => EMPTY_KNOWLEDGE_IDS,
  );

  return [selectedKnowledgeIds, store.setSelectedKnowledgeIds] as const;
}

export function useChatComposerFlow(): ChatComposerFlowStore {
  return useChatComposerFlowStore();
}
