import { NextRequest, NextResponse } from "next/server";
import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type { KnowledgeCheckResponseContract } from "@/lib/knowledge/contracts";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { path: string; is_dir: boolean };

    const response = await fetchAgent("/knowledge/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await readAgentJson<KnowledgeCheckResponseContract>(response, {});
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await readAgentJson<KnowledgeCheckResponseContract>(response, {
      exists: false,
      source_ids: [],
      name: "",
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error checking knowledge:", error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
