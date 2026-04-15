interface ActiveRun {
  threadId: string;
  runId: string;
  controller: AbortController;
}

declare global {
  var __ARTISAN_CHAT_ACTIVE_RUNS__: Map<string, ActiveRun> | undefined;
}

function getStore(): Map<string, ActiveRun> {
  if (!globalThis.__ARTISAN_CHAT_ACTIVE_RUNS__) {
    globalThis.__ARTISAN_CHAT_ACTIVE_RUNS__ = new Map<string, ActiveRun>();
  }
  return globalThis.__ARTISAN_CHAT_ACTIVE_RUNS__;
}

export function registerActiveRun(run: ActiveRun): void {
  const store = getStore();
  const existing = store.get(run.threadId);
  if (existing) {
    existing.controller.abort("superseded");
  }
  store.set(run.threadId, run);
}

export function clearActiveRun(threadId: string, runId?: string): void {
  const store = getStore();
  const current = store.get(threadId);
  if (!current) return;
  if (runId && current.runId !== runId) return;
  store.delete(threadId);
}

export function abortActiveRun(threadId?: string): number {
  const store = getStore();

  if (threadId) {
    const current = store.get(threadId);
    if (!current) return 0;
    current.controller.abort("stopped");
    store.delete(threadId);
    return 1;
  }

  const runs = [...store.values()];
  for (const run of runs) {
    run.controller.abort("stopped");
  }
  store.clear();
  return runs.length;
}
