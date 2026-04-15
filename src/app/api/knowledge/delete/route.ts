import { NextRequest, NextResponse } from "next/server";
import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type { KnowledgeDeleteResponseContract } from "@/lib/knowledge/contracts";

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get("source_id");

    if (!sourceId) {
      return NextResponse.json(
        { detail: "source_id is required" },
        { status: 400 }
      );
    }

    const response = await fetchAgent("/knowledge/delete", {
      method: "DELETE",
      query: { source_id: sourceId },
    });

    if (!response.ok) {
      const errorData = await readAgentJson<KnowledgeDeleteResponseContract>(response, {});
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await readAgentJson<KnowledgeDeleteResponseContract>(response, {
      success: true,
      message: "Deleted",
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error deleting knowledge:", error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
