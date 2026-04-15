import { NextRequest, NextResponse } from "next/server";
import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type { SkillListResponseContract } from "@/lib/skills/contracts";

export async function GET(request: NextRequest) {
  try {
    const threadId = request.nextUrl.searchParams.get("threadId")?.trim();
    if (!threadId) {
      return NextResponse.json(
        { detail: "threadId is required" },
        { status: 400 },
      );
    }

    const response = await fetchAgent(`/skills/list/${encodeURIComponent(threadId)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await readAgentJson<SkillListResponseContract>(response, {});
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await readAgentJson<SkillListResponseContract>(response, {
      skills: [],
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching skills list:", error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
