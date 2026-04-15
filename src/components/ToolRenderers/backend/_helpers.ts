export function fileName(path: string): string {
  const cleaned = path.endsWith("/") ? path.slice(0, -1) : path;
  return cleaned.split("/").filter(Boolean).pop() || path;
}

export function fileExt(path: string): string {
  const name = fileName(path);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1) : "";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function countLines(text: string): number {
  if (!text) return 0;
  return text.split("\n").length;
}

/** Check if a path string represents a directory (ends with /) */
export function isDirectory(path: string): boolean {
  return path.endsWith("/");
}

/**
 * Shorten a long path for display — show only the last N segments.
 * e.g. "/a/b/c/d/e.ts" → "…/d/e.ts"
 */
export function shortenPath(path: string, maxSegments = 3): string {
  const segments = path.split("/").filter(Boolean);
  if (segments.length <= maxSegments) return path;
  return "…/" + segments.slice(-maxSegments).join("/");
}
