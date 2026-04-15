import type { ChatStreamEventContract } from "@/lib/chat/contracts";
import { parseChatStreamEvent } from "@/lib/chat/contracts";
import type { ChatRunPayload } from "../types";
import { parseSseBuffer } from "../utils";

interface ReadChatStreamEventsOptions {
  threadIdForRun: string;
  payload: ChatRunPayload;
  reasoningMode: boolean;
  knowledgeSourceIds?: number[];
  signal: AbortSignal;
  onEvent: (event: ChatStreamEventContract) => void;
}

export async function readChatStreamEvents({
  threadIdForRun,
  payload,
  reasoningMode,
  knowledgeSourceIds,
  signal,
  onEvent,
}: ReadChatStreamEventsOptions): Promise<void> {
  const response = await fetch("/api/chat/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      threadId: threadIdForRun,
      ...payload,
      reasoningMode,
      ...(knowledgeSourceIds && knowledgeSourceIds.length > 0 ? { knowledgeSourceIds } : {}),
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Chat request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseBuffer(buffer);
    buffer = parsed.rest;

    for (const chunk of parsed.chunks) {
      if (chunk === "[DONE]") {
        continue;
      }

      try {
        const event = parseChatStreamEvent(JSON.parse(chunk));
        if (event) {
          onEvent(event);
        }
      } catch {
        // Ignore malformed chunks to match previous behavior.
      }
    }
  }
}
