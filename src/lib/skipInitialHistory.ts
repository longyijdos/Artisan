const MAX_AGE_MS = 60_000;
const CONSUME_GRACE_MS = 1_500;
const pendingSkipUntil = new Map<string, number>();
const recentConsumedUntil = new Map<string, number>();

function pruneExpired(now: number): void {
  for (const [threadId, expiresAt] of pendingSkipUntil.entries()) {
    if (expiresAt <= now) {
      pendingSkipUntil.delete(threadId);
    }
  }
  for (const [threadId, expiresAt] of recentConsumedUntil.entries()) {
    if (expiresAt <= now) {
      recentConsumedUntil.delete(threadId);
    }
  }
}

export function markSkipInitialHistory(threadId: string): void {
  if (!threadId) return;
  const now = Date.now();
  pruneExpired(now);
  pendingSkipUntil.set(threadId, now + MAX_AGE_MS);
}

export function hasSkipInitialHistory(threadId: string): boolean {
  if (!threadId) return false;
  const now = Date.now();
  pruneExpired(now);
  const pendingExpiresAt = pendingSkipUntil.get(threadId);
  if (typeof pendingExpiresAt === "number" && pendingExpiresAt > now) {
    return true;
  }
  const consumedExpiresAt = recentConsumedUntil.get(threadId);
  return typeof consumedExpiresAt === "number" && consumedExpiresAt > now;
}

export function consumeSkipInitialHistory(threadId: string): boolean {
  if (!threadId) return false;
  const now = Date.now();
  pruneExpired(now);
  const pendingExpiresAt = pendingSkipUntil.get(threadId);
  if (pendingExpiresAt && pendingExpiresAt > now) {
    pendingSkipUntil.delete(threadId);
    recentConsumedUntil.set(threadId, now + CONSUME_GRACE_MS);
    return true;
  }

  const consumedExpiresAt = recentConsumedUntil.get(threadId);
  if (consumedExpiresAt && consumedExpiresAt > now) {
    return true;
  }
  return false;
}
