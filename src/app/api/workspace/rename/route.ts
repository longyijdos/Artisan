import { NextRequest, NextResponse } from "next/server";
import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type { WorkspaceRenameResponseContract } from "@/lib/workspace/contracts";

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const oldPath = searchParams.get("old_path") || "";
  const newPath = searchParams.get("new_path") || "";
  const threadId = searchParams.get("thread_id");
  
  try {
    const response = await fetchAgent("/workspace/rename", {
      method: "POST",
      query: {
        old_path: oldPath,
        new_path: newPath,
        thread_id: threadId ?? undefined,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await readAgentJson<WorkspaceRenameResponseContract>(response, {
      message: "",
      old_path: oldPath,
      new_path: newPath,
    });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Workspace rename API proxy error:", error);
    return NextResponse.json(
      { detail: "Failed to proxy request to workspace API" },
      { status: 500 }
    );
  }
}
