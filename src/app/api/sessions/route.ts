import { NextRequest, NextResponse } from "next/server";
import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type {
  SessionCreateResponseContract,
  SessionsListResponseContract,
} from "@/lib/session/contracts";

async function proxySessions(
  request: NextRequest,
  method: "GET" | "POST",
  errorMessage: string,
) {
  const title = request.nextUrl.searchParams.get("title") ?? undefined;

  try {
    const response = await fetchAgent("/sessions", {
      method,
      query: { title },
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = method === "GET"
      ? await readAgentJson<SessionsListResponseContract>(response, { sessions: [] })
      : await readAgentJson<SessionCreateResponseContract>(response, {
          id: "",
          title: "",
          lastUpdateTime: null,
        });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(errorMessage, error);
    return NextResponse.json(
      { detail: method === "GET" ? "Failed to proxy request to sessions API" : "Failed to create session" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return proxySessions(request, "GET", "Session API proxy error:");
}

export async function POST(request: NextRequest) {
  return proxySessions(request, "POST", "Session creation API proxy error:");
}
