import { fetchAgent } from "@/app/api/_shared/agentProxy";
import type {
  AgentChatStopRequestBody,
  ChatStopRouteRequestBody,
  ChatStopRouteResponse,
} from "@/lib/chat/contracts";
import { abortActiveRun } from "../runtime-store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ChatStopRouteRequestBody;
  const threadId = body.threadId?.trim();
  const stopped = abortActiveRun(threadId);
  const upstreamBody: AgentChatStopRequestBody = { thread_id: threadId ?? null };

  await fetchAgent("/chat/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(upstreamBody),
  }).catch(() => undefined);

  const responseBody: ChatStopRouteResponse = {
    ok: true,
    stopped,
    threadId: threadId ?? null,
  };

  return Response.json(responseBody);
}
