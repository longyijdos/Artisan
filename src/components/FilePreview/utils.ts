export type FileType = "html" | "markdown" | "slide" | "code";

export function getFileType(path: string, content: string): FileType {
  const ext = path.split(".").pop()?.toLowerCase() || "";

  if (ext === "html" || ext === "htm") {
    return "html";
  }

  if (ext === "md" || ext === "markdown") {
    return "markdown";
  }

  // Check for slide XML (SML 2.0)
  if (ext === "xml") {
    const trimmed = content.trim();
    if (trimmed.startsWith("<?xml") && (trimmed.includes("sml/2.0") || trimmed.includes("presentation"))) {
      return "slide";
    }
  }

  return "code";
}

export function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    cpp: "cpp",
    c: "c",
    cs: "csharp",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    sql: "sql",
    sh: "bash",
    bash: "bash",
    md: "markdown",
  };
  return languageMap[ext] || "plaintext";
}

export function isUnsupportedPreviewError(error?: string): boolean {
  if (!error) return false;
  const text = error.toLowerCase();
  return (
    text.includes("codec can't decode") ||
    text.includes("invalid start byte") ||
    text.includes("utf-8") ||
    text.includes("unicode") ||
    text.includes("decode") ||
    text.includes("binary") ||
    text.includes("无法解码") ||
    text.includes("不支持")
  );
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
