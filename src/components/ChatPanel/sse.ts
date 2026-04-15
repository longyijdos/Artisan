import { createParser, type EventSourceMessage } from "eventsource-parser";

/**
 * Parse an SSE text buffer into decoded data chunks and any remaining incomplete data.
 *
 * Drop-in replacement for the previous hand-rolled implementation, now backed by
 * the battle-tested `eventsource-parser` library.
 */
export function parseSseBuffer(buffer: string): { chunks: string[]; rest: string } {
  const chunks: string[] = [];

  // Track how far the parser consumed so we can compute `rest`.
  let lastConsumedIndex = 0;

  const parser = createParser({
    onEvent(event: EventSourceMessage) {
      if (event.data) {
        chunks.push(event.data);
      }
    },
  });

  // Feed the entire buffer to the parser.
  parser.feed(buffer);

  // Determine the unconsumed tail.
  // eventsource-parser processes complete blocks separated by `\n\n`.
  // We find the last complete block boundary to figure out leftover bytes.
  const lastDoubleNewline = buffer.lastIndexOf("\n\n");
  if (lastDoubleNewline === -1) {
    // No complete block found — everything is leftover.
    lastConsumedIndex = 0;
  } else {
    lastConsumedIndex = lastDoubleNewline + 2;
  }

  const rest = buffer.slice(lastConsumedIndex);

  return { chunks, rest };
}
