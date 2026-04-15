import { NextResponse } from "next/server";
import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type { KnowledgeListResponseContract } from "@/lib/knowledge/contracts";

export async function GET() {
  try {
    const response = await fetchAgent("/knowledge/list", {
      method: "GET",
    });

    if (!response.ok) {
      const errorData = await readAgentJson<KnowledgeListResponseContract>(response, {});
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await readAgentJson<KnowledgeListResponseContract>(response, {
      sources: [],
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error listing knowledge:", error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
