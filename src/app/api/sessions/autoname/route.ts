import { NextRequest, NextResponse } from "next/server";
import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type {
  SessionAutonameRequestBody,
  SessionAutonameResponseContract,
} from "@/lib/session/contracts";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SessionAutonameRequestBody;
    
    const response = await fetchAgent("/sessions/autoname", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await readAgentJson<SessionAutonameResponseContract>(response, {
      title: null,
    });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Session auto-name API proxy error:", error);
    return NextResponse.json(
      { detail: "Failed to auto-name session" },
      { status: 500 }
    );
  }
}
