import { fetchAgent } from "@/app/api/_shared/agentProxy";
import type {
  AgentChatRunRequestBody,
  ChatRunRouteRequestBody,
} from "@/lib/chat/contracts";
import { clearActiveRun, registerActiveRun } from "../runtime-store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ChatRunRouteRequestBody;
  const threadId = body.threadId?.trim();
  const message = body.message?.trim();
  const toolCallId = body.toolCallId?.trim();
  const hasToolResult = Object.prototype.hasOwnProperty.call(body, "toolResult");
  const toolResult = body.toolResult;
  const reasoningMode = typeof body.reasoningMode === "boolean" ? body.reasoningMode : false;
  const knowledgeSourceIds = Array.isArray(body.knowledgeSourceIds) ? body.knowledgeSourceIds : [];
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  if (!threadId) {
    return Response.json({ detail: "threadId is required" }, { status: 400 });
  }
  if (!message && !(toolCallId && hasToolResult)) {
    return Response.json(
      { detail: "message is required, or provide toolCallId + toolResult" },
      { status: 400 },
    );
  }

  const runId = `run-${crypto.randomUUID()}`;
  const controller = new AbortController();

  registerActiveRun({
    threadId,
    runId,
    controller,
  });

  try {
    const upstreamBody: AgentChatRunRequestBody = {
      thread_id: threadId,
      run_id: runId,
      reasoning_mode: reasoningMode,
      knowledge_source_ids: knowledgeSourceIds,
      attachments,
      ...(message ? { message } : {}),
      ...(toolCallId && hasToolResult
        ? {
            tool_call_id: toolCallId,
            tool_result: toolResult,
          }
        : {}),
    };

    const upstream = await fetchAgent("/chat/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(upstreamBody),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      clearActiveRun(threadId, runId);
      const upstreamText = await upstream.text();
      return new Response(upstreamText, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("content-type") || "text/plain; charset=utf-8",
        },
      });
    }

    if (!upstream.body) {
      clearActiveRun(threadId, runId);
      const upstreamText = await upstream.text();
      return new Response(upstreamText, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("content-type") || "text/plain; charset=utf-8",
        },
      });
    }

    const reader = upstream.body.getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(streamController) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            clearActiveRun(threadId, runId);
            streamController.close();
            return;
          }
          streamController.enqueue(value);
        } catch (error) {
          clearActiveRun(threadId, runId);
          if (!controller.signal.aborted) {
            streamController.error(error);
            return;
          }
          streamController.close();
        }
      },
      cancel() {
        reader.cancel().catch(() => undefined);
        clearActiveRun(threadId, runId);
      },
    });

    return new Response(stream, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    clearActiveRun(threadId, runId);
    if (controller.signal.aborted) {
      return Response.json({ detail: "run aborted" }, { status: 499 });
    }
    const messageText = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ detail: messageText }, { status: 500 });
  }
}
