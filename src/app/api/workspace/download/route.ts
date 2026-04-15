import { NextRequest, NextResponse } from "next/server";
import { fetchAgent, readAgentJson } from "@/app/api/_shared/agentProxy";
import type { WorkspaceErrorResponseContract } from "@/lib/workspace/contracts";

function toAsciiFilenameFallback(filename: string): string {
  const safe = filename
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 32 && code <= 126 && ch !== '"' && ch !== "\\") {
        return ch;
      }
      return "_";
    })
    .join("")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[.\s]+$/, "");
  return safe || "download";
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get("path") || "";
  const threadId = searchParams.get("thread_id");
  
  if (!path) {
    return NextResponse.json(
      { detail: "Path is required" },
      { status: 400 }
    );
  }
  
  try {
    const response = await fetchAgent("/workspace/download", {
      method: "GET",
      query: {
        path,
        thread_id: threadId ?? undefined,
      },
    });

    // Check if response is JSON (error) or file content
    const contentType = response.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      const data = await readAgentJson<WorkspaceErrorResponseContract>(response, {});
      return NextResponse.json(data, { status: response.status });
    }

    // Get headers from backend response
    const contentDisposition = response.headers.get("content-disposition");
    const contentLength = response.headers.get("content-length");
    
    // Stream the response body directly to client
    const headers: HeadersInit = {
      "Content-Type": contentType || "application/octet-stream",
    };
    
    if (contentDisposition) {
      headers["Content-Disposition"] = contentDisposition;
    } else {
      const filename = path.split("/").pop() || "download";
      const asciiFallback = toAsciiFilenameFallback(filename);
      const encodedFilename = encodeURIComponent(filename);
      headers["Content-Disposition"] = `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;
    }
    
    if (contentLength) {
      headers["Content-Length"] = contentLength;
    }

    // Pass through the readable stream for true streaming
    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Workspace download proxy error:", error);
    return NextResponse.json(
      { detail: "Failed to download file" },
      { status: 500 }
    );
  }
}
