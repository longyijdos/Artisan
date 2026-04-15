import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type { ChatHistoryResponseContract } from "@/lib/chat/contracts";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("threadId");
  const before = searchParams.get("before");
  const limit = searchParams.get("limit");

  if (!threadId) {
    return Response.json({ detail: "threadId is required" }, { status: 400 });
  }

  try {
    const upstream = await fetchAgent(`/chat/history/${encodeURIComponent(threadId)}`, {
      method: "GET",
      query: {
        before: before ?? undefined,
        limit: limit ?? undefined,
      },
      headers: { Accept: "application/json" },
      timeoutMs: 15_000,
    });

    const data = await readAgentJson<ChatHistoryResponseContract>(upstream, { messages: [] });
    return Response.json(data, {
      status: upstream.status,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { detail: "Upstream timeout loading chat history" },
      { status: 504 },
    );
  }
}
