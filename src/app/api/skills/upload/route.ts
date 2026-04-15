import { NextRequest, NextResponse } from "next/server";
import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type { SkillUploadResponseContract } from "@/lib/skills/contracts";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const response = await fetchAgent("/skills/upload", {
      method: "POST",
      body: formData,
    });

    const data = await readAgentJson<SkillUploadResponseContract>(response, {
      success: false,
      message: "",
      skill_name: "",
    });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Skill upload proxy error:", error);
    return NextResponse.json(
      { detail: "Failed to proxy skill upload request" },
      { status: 500 }
    );
  }
}
