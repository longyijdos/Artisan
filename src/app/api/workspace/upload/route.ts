import { NextRequest, NextResponse } from "next/server";
import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type { WorkspaceUploadResponseContract } from "@/lib/workspace/contracts";

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get("path") || "";
  const threadId = searchParams.get("thread_id");

  try {
    // Get the form data from the incoming request
    const formData = await request.formData();

    // Forward the request to the backend
    const response = await fetchAgent("/workspace/upload", {
      method: "POST",
      query: {
        path: path || undefined,
        thread_id: threadId ?? undefined,
      },
      body: formData,
    });

    const data = await readAgentJson<WorkspaceUploadResponseContract>(response, {
      message: "",
      filename: "",
      path: "",
    });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Workspace upload proxy error:", error);
    return NextResponse.json(
      { detail: "Failed to proxy upload request" },
      { status: 500 }
    );
  }
}
