import { NextRequest, NextResponse } from "next/server";
import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type {
  SessionDeleteResponseContract,
  SessionUpdateTitleResponseContract,
} from "@/lib/session/contracts";

function getSessionId(request: NextRequest): string | null {
  const sessionId = request.nextUrl.searchParams.get("sessionId")?.trim();
  return sessionId && sessionId.length > 0 ? sessionId : null;
}

export async function DELETE(request: NextRequest) {
  const sessionId = getSessionId(request);

  if (!sessionId) {
    return NextResponse.json(
      { detail: "sessionId is required" },
      { status: 400 },
    );
  }

  try {
    const response = await fetchAgent(`/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });

    const data = await readAgentJson<SessionDeleteResponseContract>(response, {
      success: false,
      id: sessionId,
    });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Session deletion API proxy error:", error);
    return NextResponse.json(
      { detail: "Failed to delete session" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const sessionId = getSessionId(request);
  const title = request.nextUrl.searchParams.get("title");

  if (!sessionId) {
    return NextResponse.json(
      { detail: "sessionId is required" },
      { status: 400 },
    );
  }

  try {
    const response = await fetchAgent(`/sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      query: { title: title ?? undefined },
    });

    const data = await readAgentJson<SessionUpdateTitleResponseContract>(response, {
      success: false,
      id: sessionId,
      title: title ?? "",
    });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Session update API proxy error:", error);
    return NextResponse.json(
      { detail: "Failed to update session" },
      { status: 500 },
    );
  }
}
