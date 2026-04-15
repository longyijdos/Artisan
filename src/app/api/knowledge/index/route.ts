import { NextRequest, NextResponse } from "next/server";
import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type {
  KnowledgeIndexRequestBody,
  KnowledgeIndexResponseContract,
} from "@/lib/knowledge/contracts";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as KnowledgeIndexRequestBody;

    const response = await fetchAgent("/knowledge/index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeoutMs: 120_000, // Indexing can take a while
    });

    if (!response.ok) {
      const errorData = await readAgentJson<KnowledgeIndexResponseContract>(response, {});
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await readAgentJson<KnowledgeIndexResponseContract>(response, {
      success: true,
      message: "",
      results: [],
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error indexing knowledge:", error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
