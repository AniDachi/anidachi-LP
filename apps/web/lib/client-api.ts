export class ApiError extends Error {
  constructor(message: string, readonly code: string | undefined, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithSessionRefresh(path, init);
  const body = (await response.json().catch(() => null)) as
    | T
    | { error?: unknown; message?: unknown; code?: unknown }
    | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object"
        ? String(
            (body as { message?: unknown; error?: unknown }).message ??
              (body as { message?: unknown; error?: unknown }).error ??
              `Request failed (${response.status})`
          )
        : `Request failed (${response.status})`;
    const code = body && typeof body === "object" && "code" in body && typeof body.code === "string" ? body.code : undefined;
    throw new ApiError(message, code, response.status);
  }

  return body as T;
}

// Share only an in-flight cookie refresh, never account data or an access decision.
let sessionRefresh: Promise<boolean> | null = null;
let refreshGeneration = 0;

function refreshSession(): Promise<boolean> {
  if (!sessionRefresh) {
    sessionRefresh = fetch("/api/auth/refresh", { method: "POST" })
      .then(response => {
        if (response.ok) refreshGeneration++;
        return response.ok;
      })
      .finally(() => { sessionRefresh = null; });
  }
  return sessionRefresh;
}

async function fetchWithSessionRefresh(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  init?.signal?.throwIfAborted();
  const startedGeneration = refreshGeneration;
  const response = await fetch(path, withJsonHeaders(init));
  if (response.status !== 401) return response;

  init?.signal?.throwIfAborted();
  // A concurrent request may already have refreshed while this 401 was in flight.
  const refreshed = startedGeneration !== refreshGeneration || await refreshSession();
  init?.signal?.throwIfAborted();
  if (!refreshed) return response;
  return fetch(path, withJsonHeaders(init));
}

function withJsonHeaders(init?: RequestInit): RequestInit | undefined {
  const headers = new Headers(init?.headers);
  if (typeof init?.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return { ...init, headers };
}
