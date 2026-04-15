import { NextRequest, NextResponse } from "next/server";
import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type {
  SkillMutationRequestBody,
  SkillMutationResponseContract,
} from "@/lib/skills/contracts";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SkillMutationRequestBody;
    
    const response = await fetchAgent("/skills/install", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await readAgentJson<SkillMutationResponseContract>(response, {});
      return NextResponse.json(
        errorData,
        { status: response.status }
      );
    }

    const data = await readAgentJson<SkillMutationResponseContract>(response, {
      success: true,
      message: "",
      skill_name: body.skill_name,
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error installing skill:", error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
