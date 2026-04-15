import { NextRequest, NextResponse } from "next/server";
import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type { WorkspaceFilesResponseContract } from "@/lib/workspace/contracts";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get("path") || "";
  const threadId = searchParams.get("thread_id");
  
  try {
    const response = await fetchAgent("/workspace/files", {
      method: "GET",
      query: {
        path,
        thread_id: threadId ?? undefined,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await readAgentJson<WorkspaceFilesResponseContract>(response, []);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Workspace API proxy error:", error);
    return NextResponse.json(
      { detail: "Failed to proxy request to workspace API" },
      { status: 500 }
    );
  }
}
