import type {
  ChatHistoryPagingContract,
  ChatHistoryResponseContract,
} from "@/lib/chat/contracts";

const HISTORY_PAGE_SIZE = 80;

export function resolveHistoryPaging(
  paging?: ChatHistoryPagingContract,
): { nextBefore: number | null; hasMoreHistory: boolean } {
  const nextBefore =
    typeof paging?.next_before === "number" ? paging.next_before : null;

  return {
    nextBefore,
    hasMoreHistory: Boolean(paging?.has_more && nextBefore !== null),
  };
}

export async function fetchHistoryPage(
  threadId: string,
  options: { before?: number | null; signal?: AbortSignal },
): Promise<ChatHistoryResponseContract> {
  const params = new URLSearchParams();
  params.set("threadId", threadId);
  params.set("limit", String(HISTORY_PAGE_SIZE));
  if (typeof options.before === "number") {
    params.set("before", String(options.before));
  }

  const response = await fetch(`/api/chat/history?${params.toString()}`, {
    method: "GET",
    signal: options.signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`history request failed: ${response.status}`);
  }

  return (await response
    .json()
    .catch(() => ({ messages: [], paging: { has_more: false, next_before: null } }))) as ChatHistoryResponseContract;
}
