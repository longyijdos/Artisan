import { NextRequest, NextResponse } from "next/server";
import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type { WorkspaceMkdirResponseContract } from "@/lib/workspace/contracts";

export async function POST(request: NextRequest) {
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
    const response = await fetchAgent("/workspace/mkdir", {
      method: "POST",
      query: {
        path,
        thread_id: threadId ?? undefined,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await readAgentJson<WorkspaceMkdirResponseContract>(response, {
      message: "",
      path,
    });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Workspace mkdir proxy error:", error);
    return NextResponse.json(
      { detail: "Failed to create folder" },
      { status: 500 }
    );
  }
}
