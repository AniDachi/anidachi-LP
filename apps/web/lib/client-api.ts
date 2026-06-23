export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithSessionRefresh(path, init);
  const body = (await response.json().catch(() => null)) as
    | T
    | { error?: unknown; message?: unknown }
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
    throw new Error(message);
  }

  return body as T;
}

async function fetchWithSessionRefresh(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(path, withJsonHeaders(init));
  if (response.status !== 401) return response;

  const refreshResponse = await fetch("/api/auth/refresh", {
    method: "POST",
  });
  if (!refreshResponse.ok) return response;

  return fetch(path, withJsonHeaders(init));
}

function withJsonHeaders(init?: RequestInit): RequestInit | undefined {
  const headers = new Headers(init?.headers);
  if (typeof init?.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return { ...init, headers };
}
