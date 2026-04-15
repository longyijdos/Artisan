import { NextRequest, NextResponse } from "next/server";
import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type { WorkspaceDeleteResponseContract } from "@/lib/workspace/contracts";

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get("path") || "";
  const threadId = searchParams.get("thread_id");

  try {
    const response = await fetchAgent("/workspace/delete", {
      method: "DELETE",
      query: {
        path,
        thread_id: threadId ?? undefined,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await readAgentJson<WorkspaceDeleteResponseContract>(response, {
      message: "",
      path,
    });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Workspace delete API proxy error:", error);
    return NextResponse.json(
      { detail: "Failed to proxy request to workspace API" },
      { status: 500 }
    );
  }
}
