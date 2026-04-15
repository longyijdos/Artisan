import { NextRequest, NextResponse } from "next/server";
import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type { WorkspaceReadResponseContract } from "@/lib/workspace/contracts";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get("path") || "";
  const threadId = searchParams.get("thread_id");
  
  if (!path) {
    return NextResponse.json(
      { detail: "Path is required" },
      { status: 400 }
    );
  }
  
  try {
    const response = await fetchAgent("/workspace/read", {
      method: "GET",
      query: {
        path,
        thread_id: threadId ?? undefined,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await readAgentJson<WorkspaceReadResponseContract>(response, {
      content: "",
      path,
    });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Workspace API proxy error:", error);
    return NextResponse.json(
      { detail: "Failed to proxy request to workspace API" },
      { status: 500 }
    );
  }
}
