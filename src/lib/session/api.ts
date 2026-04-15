import type {
  SessionAutonameRequestBody,
  SessionAutonameResponseContract,
  SessionCreateResponseContract,
  SessionDeleteResponseContract,
  SessionsListResponseContract,
  SessionUpdateTitleResponseContract,
} from "./contracts";

const SESSION_API_BASE = "/api";

interface JsonRequestResult<T> {
  response: Response;
  data: T | null;
}

function withSearchParams(
  path: string,
  params: Record<string, string | undefined>,
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 0) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return `${SESSION_API_BASE}${path}${query ? `?${query}` : ""}`;
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<JsonRequestResult<T>> {
  const response = await fetch(path, init);
  const data = (await response.json().catch(() => null)) as T | null;

  return { response, data };
}

export function fetchSessionsRequest(): Promise<
  JsonRequestResult<SessionsListResponseContract>
> {
  return requestJson<SessionsListResponseContract>(`${SESSION_API_BASE}/sessions`);
}

export function createSessionRequest(
  title?: string,
): Promise<JsonRequestResult<SessionCreateResponseContract>> {
  return requestJson<SessionCreateResponseContract>(
    withSearchParams("/sessions", { title }),
    { method: "POST" },
  );
}

export function deleteSessionRequest(
  sessionId: string,
): Promise<JsonRequestResult<SessionDeleteResponseContract>> {
  return requestJson<SessionDeleteResponseContract>(
    withSearchParams("/sessions/item", { sessionId }),
    { method: "DELETE" },
  );
}

export function updateSessionTitleRequest(
  sessionId: string,
  title: string,
): Promise<JsonRequestResult<SessionUpdateTitleResponseContract>> {
  return requestJson<SessionUpdateTitleResponseContract>(
    withSearchParams("/sessions/item", { sessionId, title }),
    { method: "PATCH" },
  );
}

export function autoNameSessionRequest(
  message: string,
): Promise<JsonRequestResult<SessionAutonameResponseContract>> {
  const body: SessionAutonameRequestBody = { message };
  return requestJson<SessionAutonameResponseContract>(
    `${SESSION_API_BASE}/sessions/autoname`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}
