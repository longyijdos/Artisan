import { NextRequest, NextResponse } from "next/server";
import { buildAgentUrl } from "@/app/api/_shared/agentProxy";
import type { TerminalProxyResponseContract } from "@/lib/system/contracts";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId")?.trim();

  if (!sessionId) {
    return NextResponse.json(
      { detail: "sessionId is required" },
      { status: 400 },
    );
  }

  const proxyUrl = buildAgentUrl(`/sandbox/${encodeURIComponent(sessionId)}/terminal/`);
  const response: TerminalProxyResponseContract = { url: proxyUrl };
  return NextResponse.json(response, { status: 200 });
}
