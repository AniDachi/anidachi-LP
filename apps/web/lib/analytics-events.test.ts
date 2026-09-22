import { dom } from "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { AnalyticsEvents } from "../components/analytics-events";

// These checks exercise the real component without sending external telemetry.
delete process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
const originalFetch = globalThis.fetch;
const requests: Array<{ url: string; method: string; signal?: AbortSignal | null }> = [];
let root: Root | null = null;

async function render(pathname = "/extension") {
  if (!root) {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  }
  await act(async () => {
    root!.render(React.createElement(PathnameContext.Provider, { value: pathname },
      React.createElement(AnalyticsEvents)));
  });
}

function respond(status: number) {
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), method: init?.method ?? "GET", signal: init?.signal });
    return Response.json(status === 200
      ? { user: { id: "test-user", displayName: "Alex", email: "alex@example.com", plan: "plus" } }
      : { error: "Unavailable" }, { status });
  };
}

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  dom.sessionStorage.clear();
  globalThis.fetch = originalFetch;
  requests.length = 0;
});

test("an expired session triggers one account read and never an auth refresh", async () => {
  respond(401);
  await render();
  assert.deepEqual(requests.map(({ url, method }) => ({ url, method })), [
    { url: "/api/me", method: "GET" },
  ]);
});

test("a signed-in visitor is read once on mount and once per navigation", async () => {
  respond(200);
  await render();
  assert.equal(requests.length, 1);
  await render();
  assert.equal(requests.length, 1, "an unchanged route does not repeat the read");
  await render("/pricing");
  assert.equal(requests.length, 2);
  assert.ok(requests.every(({ url, method }) => url === "/api/me" && method === "GET"));
});

test("navigation and unmount cancel pending account reads", async () => {
  globalThis.fetch = (input, init) => {
    requests.push({ url: String(input), method: init?.method ?? "GET", signal: init?.signal });
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });
  };
  await render();
  const first = requests[0].signal;
  assert.ok(first, "the analytics read must be cancellable");
  assert.equal(first.aborted, false);
  await render("/pricing");
  assert.equal(first.aborted, true);
  assert.equal(first.reason, "analytics-cancelled");
  assert.equal(requests[1].signal?.aborted, false);
  await act(async () => root!.unmount());
  root = null;
  assert.equal(requests[1].signal?.aborted, true);
});

test("temporary server errors do not retry or mutate authentication", async () => {
  respond(503);
  await render();
  assert.deepEqual(requests.map(({ url, method }) => ({ url, method })), [
    { url: "/api/me", method: "GET" },
  ]);
});

test("a failed account read does not break the page or start another request", async () => {
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), method: init?.method ?? "GET", signal: init?.signal });
    throw new TypeError("Network unavailable");
  };
  await render();
  assert.equal(requests.length, 1);
});
