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

test("client api preserves structured authority codes and human error precedence", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const status of [403, 409, 503]) {
      globalThis.fetch = async () => Response.json({ code: "HISTORY_ACCESS_CHANGED", error: "Human fallback", message: "Human message" }, { status });
      await assert.rejects(api("/api/watch-history/v3"), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "Human message");
        assert.equal((error as Error & { code: string }).code, "HISTORY_ACCESS_CHANGED");
        assert.equal((error as Error & { status: number }).status, status);
        return true;
      });
    }
    globalThis.fetch = async () => new Response("invalid JSON", { status: 503 });
    await assert.rejects(api("/api/watch-history/v3"), /Request failed \(503\)/);
  } finally { globalThis.fetch = originalFetch; }
});

test("concurrent expired requests share one refresh and each retry once", async () => {
  const originalFetch = globalThis.fetch;
  let finish!: (value: Response) => void;
  let refreshes = 0;
  const attempts = new Map<string, number>();
  globalThis.fetch = async path => {
    const url = String(path);
    if (url === "/api/auth/refresh") { refreshes++; return new Promise(resolve => { finish = resolve; }); }
    const count = (attempts.get(url) ?? 0) + 1; attempts.set(url, count);
    return count === 1 ? Response.json({}, { status: 401 }) : Response.json({ ok: true });
  };
  try {
    const first = api("/api/friends");
    const second = api("/api/groups");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(refreshes, 1);
    finish(Response.json({ ok: true }));
    await Promise.all([first, second]);
    assert.deepEqual([...attempts.values()], [2, 2]);
  } finally { globalThis.fetch = originalFetch; }
});

test("an aborted request does not retry after the shared session refresh", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let finish!: (value: Response) => void;
  let requests = 0;
  globalThis.fetch = async path => {
    if (String(path) === "/api/auth/refresh") return new Promise(resolve => { finish = resolve; });
    requests++; return Response.json({}, { status: 401 });
  };
  try {
    const pending = api("/api/friends", { signal: controller.signal });
    const rejected = assert.rejects(pending, /abort/i);
    await new Promise(resolve => setImmediate(resolve));
    controller.abort(); finish(Response.json({ ok: true }));
    await rejected;
    assert.equal(requests, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("a late concurrent 401 reuses the refresh already completed for its request generation", async () => {
  const originalFetch = globalThis.fetch;
  let late!: (value: Response) => void;
  let refreshes = 0;
  const calls = new Map<string, number>();
  globalThis.fetch = async input => {
    const path = String(input);
    if (path === "/api/auth/refresh") { refreshes++; return Response.json({ ok: true }); }
    const count = (calls.get(path) ?? 0) + 1; calls.set(path, count);
    if (path === "/slow" && count === 1) return new Promise(resolve => { late = resolve; });
    return count === 1 ? Response.json({}, { status: 401 }) : Response.json({ ok: true });
  };
  try {
    const slow = api("/slow");
    await api("/fast");
    late(Response.json({}, { status: 401 }));
    await slow;
    assert.equal(refreshes, 1);
    assert.equal(calls.get("/slow"), 2);
  } finally { globalThis.fetch = originalFetch; }
});
test("a failed shared refresh is released so a later request can recover", async () => {
  const originalFetch = globalThis.fetch;
  let refreshes = 0, reads = 0;
  globalThis.fetch = async input => {
    if (String(input) === "/api/auth/refresh") return Response.json({}, { status: ++refreshes === 1 ? 503 : 200 });
    return Response.json({}, { status: ++reads < 3 ? 401 : 200 });
  };
  try {
    await assert.rejects(api("/data"));
    await api("/data");
    assert.equal(refreshes, 2);
  } finally { globalThis.fetch = originalFetch; }
});
