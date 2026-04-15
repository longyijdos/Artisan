import { AGENT_API_BASE } from "@/lib/api";

type AgentQueryValue = string | number | boolean | null | undefined;

interface FetchAgentOptions extends Omit<RequestInit, "signal"> {
  query?: Record<string, AgentQueryValue>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export function buildAgentUrl(
  path: string,
  query?: Record<string, AgentQueryValue>,
): string {
  const normalizedBase = AGENT_API_BASE.endsWith("/")
    ? AGENT_API_BASE.slice(0, -1)
    : AGENT_API_BASE;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${normalizedBase}${normalizedPath}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

export function fetchAgent(
  path: string,
  options: FetchAgentOptions = {},
): Promise<Response> {
  const { query, signal, timeoutMs, ...init } = options;

  return fetch(buildAgentUrl(path, query), {
    ...init,
    signal: signal ?? (timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined),
  });
}

export async function readAgentJson<T>(
  response: Response,
  fallback?: T,
): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error("Failed to parse JSON response from agent");
  }
}
