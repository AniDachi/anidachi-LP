import assert from "node:assert/strict";
import test from "node:test";
import { api } from "./client-api";

test("client api refreshes the website session once on 401 and retries the request", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ body?: BodyInit | null; contentType: string | null; url: string }> = [];
  let dataRequests = 0;

  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({
      body: init?.body ?? null,
      contentType: headers.get("Content-Type"),
      url,
    });

    if (url === "/api/watch-library") {
      dataRequests += 1;
      if (dataRequests === 1) {
        return Response.json({ error: "Expired access token" }, { status: 401 });
      }
      return Response.json({ ok: true });
    }

    if (url === "/api/auth/refresh") {
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unexpected request" }, { status: 500 });
  }) as typeof fetch;

  try {
    const result = await api<{ ok: boolean }>("/api/watch-library", {
      body: JSON.stringify({ refresh: true }),
      method: "POST",
    });
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(
      calls.map((call) => call.url),
      ["/api/watch-library", "/api/auth/refresh", "/api/watch-library"],
    );
    assert.equal(calls[0]?.contentType, "application/json");
    assert.equal(calls[2]?.body, JSON.stringify({ refresh: true }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("client api keeps the original error when session refresh fails", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url === "/api/watch-library") {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }
    if (url === "/api/auth/refresh") {
      return Response.json({ error: "Invalid refresh token" }, { status: 401 });
    }
    return Response.json({ error: "Unexpected request" }, { status: 500 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      api("/api/watch-library"),
      /Not signed in/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
