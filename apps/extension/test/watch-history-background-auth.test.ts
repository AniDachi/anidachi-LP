import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAuthTokens } from "../src/auth-tokens";
import {
  flushWatchHistoryInBackground,
  handleWatchHistoryAuthSessionChange,
} from "../src/watch-history-client";
import {
  createWatchHistoryStorage,
  watchHistoryPartitionKey,
  type WatchHistoryStorageRoot,
} from "../src/watch-history-storage";
import { paidHistoryLease } from "./watch-history-personal-fixtures";

// Replace browser persistence, not auth/session logic: /api/me and refresh
// requests below still run through the real default background dependencies.
const persisted = vi.hoisted(() => new Map<string, unknown>());
vi.mock("wxt/utils/storage", () => ({
  storage: {
    getItem: async (key: string) => structuredClone(persisted.get(key) ?? null),
    setItem: async (key: string, value: unknown) => { persisted.set(key, structuredClone(value)); },
    removeItem: async (key: string) => { persisted.delete(key); },
    defineItem: (key: string, options?: { fallback?: unknown }) => ({
      getValue: async () => structuredClone(persisted.get(key) ?? options?.fallback ?? null),
      setValue: async (value: unknown) => { persisted.set(key, structuredClone(value)); },
      removeValue: async () => { persisted.delete(key); },
      watch: () => () => {},
    }),
  },
}));

const session: ExtensionAuthTokens = {
  accessToken: "access-a",
  refreshToken: "refresh-a",
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "owner@example.com",
    displayName: "Owner",
    avatarUrl: null,
    plan: "plus",
  },
};

function historyHarness() {
  let root: WatchHistoryStorageRoot = { schemaVersion: 3, activeGenerations: {}, partitions: {} };
  const storage = createWatchHistoryStorage({
    item: {
      getValue: async () => structuredClone(root),
      setValue: async (value) => { root = structuredClone(value); },
    },
    getBytesInUse: async () => 0,
    quotaBytes: 1_000_000,
  });
  const lease = paidHistoryLease(session.user.id, Date.now());
  const canonical = {
    meta: { schemaVersion: 3, ownerUserId: session.user.id, accountGeneration: 1, serverTime: new Date().toISOString() },
    generatedAt: new Date().toISOString(),
    totalTitleCount: 0,
    items: [],
    nextCursor: null,
  };
  const requests: Array<{ path: string; authorization: string | null }> = [];
  const respond = (path: string) => {
    if (path === "/api/me") return Response.json({ user: session.user });
    if (path === "/api/watch-history/v3/access") return Response.json(lease.access);
    if (path === "/api/watch-history/v3") return Response.json(canonical);
    throw new Error(`Unexpected request: ${path}`);
  };
  const installFetch = (handler: (path: string, init?: RequestInit) => Response | Promise<Response> = respond) => {
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      requests.push({ path, authorization: new Headers(init?.headers).get("Authorization") });
      return handler(path, init);
    });
  };
  return { storage, dependencies: { storage, hasRecordingConsent: async () => true }, lease, canonical, requests, respond, installFetch, read: () => root };
}

beforeEach(() => {
  persisted.clear();
  persisted.set("local:authTokens", structuredClone(session));
});
afterEach(() => vi.unstubAllGlobals());

describe("watch history background session authority", () => {
  it("bootstraps and reconciles an auth change without /api/me for each owner check", async () => {
    const h = historyHarness();
    h.installFetch();

    expect(await handleWatchHistoryAuthSessionChange(null, session, h.dependencies)).toMatchObject({ ok: true });

    expect(h.requests.map(({ path }) => path)).toEqual([
      "/api/watch-history/v3/access", "/api/watch-history/v3",
    ]);
    expect(h.read().partitions[watchHistoryPartitionKey(session.user.id, 1)]?.cache).toEqual(h.canonical);
  });

  it("restores a background drain from persisted authority without repeated user validation", async () => {
    const h = historyHarness();
    h.installFetch();
    await handleWatchHistoryAuthSessionChange(null, session, h.dependencies);
    h.requests.length = 0;

    // Both invocations reconstruct their client from storage, as an alarm or
    // fresh worker does; no in-memory auth cache is required for the reduction.
    await flushWatchHistoryInBackground(h.dependencies);
    await flushWatchHistoryInBackground(h.dependencies);

    expect(h.requests.map(({ path }) => path)).toEqual([
      "/api/watch-history/v3", "/api/watch-history/v3",
    ]);
    expect(h.read().partitions[watchHistoryPartitionKey(session.user.id, 1)]?.cache).toEqual(h.canonical);
  });

  it("validates and refreshes credentials only after a history request returns 401", async () => {
    const h = historyHarness();
    h.installFetch((path, init) => {
      const bearer = new Headers(init?.headers).get("Authorization");
      if (path === "/api/extension/auth/refresh") return Response.json({ accessToken: "access-fresh", refreshToken: "refresh-fresh" });
      if ((path === "/api/me" || path === "/api/watch-history/v3/access") && bearer === "Bearer access-a") {
        return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
      }
      return h.respond(path);
    });

    await handleWatchHistoryAuthSessionChange(null, session, h.dependencies);

    expect(h.requests.map(({ path }) => path)).toEqual([
      "/api/watch-history/v3/access", "/api/me", "/api/extension/auth/refresh", "/api/me", "/api/watch-history/v3/access",
    ]);
    expect(h.requests.at(-1)?.authorization).toBe("Bearer access-fresh");
    expect(persisted.get("local:authTokens")).toMatchObject({ accessToken: "access-fresh", refreshToken: "refresh-fresh" });
    // The old-session pass cannot continue draining after token rotation.
    expect(h.requests.some(({ path }) => path === "/api/watch-history/v3/progress")).toBe(false);
  });

  it("retains the network refresh path for a background drain with an expired bearer", async () => {
    const h = historyHarness();
    h.installFetch();
    await handleWatchHistoryAuthSessionChange(null, session, h.dependencies);
    h.requests.length = 0;
    h.installFetch((path, init) => {
      const bearer = new Headers(init?.headers).get("Authorization");
      if (path === "/api/extension/auth/refresh") return Response.json({ accessToken: "access-fresh", refreshToken: "refresh-fresh" });
      if ((path === "/api/me" || path === "/api/watch-history/v3") && bearer === "Bearer access-a") {
        return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
      }
      return h.respond(path);
    });

    await flushWatchHistoryInBackground(h.dependencies);

    expect(h.requests.map(({ path }) => path)).toEqual([
      "/api/watch-history/v3", "/api/me", "/api/extension/auth/refresh", "/api/me", "/api/watch-history/v3",
    ]);
    expect(h.requests.at(-1)?.authorization).toBe("Bearer access-fresh");
    expect(persisted.get("local:authTokens")).toMatchObject({ accessToken: "access-fresh" });
  });

  it("keeps rejected credentials untrusted when token refresh is unavailable", async () => {
    const h = historyHarness();
    h.installFetch((path) => {
      if (path === "/api/extension/auth/refresh") return Response.json({ code: "UNAVAILABLE" }, { status: 503 });
      if (path === "/api/me" || path === "/api/watch-history/v3/access") return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
      return h.respond(path);
    });

    expect(await handleWatchHistoryAuthSessionChange(null, session, h.dependencies)).toMatchObject({ ok: false, status: "retryable" });

    expect(h.requests.map(({ path }) => path)).toEqual([
      "/api/watch-history/v3/access", "/api/me", "/api/extension/auth/refresh",
    ]);
    expect(h.read().partitions).toEqual({});
    expect(persisted.get("local:authTokens")).toEqual(session);
  });

  it.each(["switch", "logout"] as const)("rejects delayed authority after %s without persisting an old-owner lease", async (change) => {
    const h = historyHarness();
    let finish!: (response: Response) => void;
    h.installFetch((path) => path === "/api/watch-history/v3/access"
      ? new Promise<Response>((resolve) => { finish = resolve; })
      : h.respond(path));

    const pending = handleWatchHistoryAuthSessionChange(null, session, h.dependencies);
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    if (change === "logout") persisted.delete("local:authTokens");
    else persisted.set("local:authTokens", {
      ...session, accessToken: "access-b", refreshToken: "refresh-b",
      user: { ...session.user, id: "00000000-0000-4000-8000-000000000002" },
    });
    finish(Response.json(h.lease.access));

    expect(await pending).toMatchObject({ ok: false });
    expect(h.read().partitions[watchHistoryPartitionKey(session.user.id, 1)]?.accessLease).toBeUndefined();
    expect(h.requests.map(({ path }) => path)).toEqual(["/api/watch-history/v3/access"]);
  });
});
