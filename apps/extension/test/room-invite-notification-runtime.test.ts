import type { AccountInboxResponse } from "@anidachi/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAuthTokens } from "../src/auth-tokens";

const state = vi.hoisted(() => ({ map: new Map<string, unknown>() }));
vi.mock("wxt/utils/storage", () => ({ storage: {
  getItem: async (key: string) => state.map.get(key) ?? null,
  setItem: async (key: string, value: unknown) => { state.map.set(key, value); },
  removeItem: async (key: string) => { state.map.delete(key); },
} }));
vi.mock("../src/constants", async (original) => ({
  ...await original<object>(), WXT_VAPID_PUBLIC_KEY: "AQID",
}));

const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
const AUTH = "local:authTokens";
const REGISTRATION = "local:anidachi.roomInviteNotifications.registration";
let runtime: typeof import("../src/room-invite-notifications");
let create: ReturnType<typeof vi.fn>;
let badge: ReturnType<typeof vi.fn>;
let http: ReturnType<typeof vi.fn<(url: URL, init?: RequestInit) => Promise<Response>>>;

function tokens(id = A, accessToken = "access-1"): ExtensionAuthTokens {
  return { accessToken, refreshToken: "refresh-1", user: {
    id, email: "test@example.com", displayName: "Viewer", avatarUrl: null, plan: "free",
  } };
}
function inbox(id = A, withItem = true): AccountInboxResponse {
  const at = "2026-09-04T00:00:00.000Z";
  return { meta: { ownerUserId: id, schemaVersion: 1, serverTime: at },
    items: withItem ? [{ kind: "friend-request", friendshipId: B,
      sender: { userId: B, displayName: "Friend", avatarUrl: null, handle: null },
      state: "pending", createdAt: at, activityAt: at, seenAt: null }] : [],
    counts: { unseen: withItem ? 1 : 0, actionable: withItem ? 1 : 0,
      activeRoomInvites: 0, pendingFriendRequests: withItem ? 1 : 0 }, nextCursor: null };
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
function registered() {
  return json({ deviceId: B, notificationsEnabled: true, updatedAt: "2026-09-04T00:00:00.000Z" });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function requests(path: string) {
  return http.mock.calls.filter(([url]) => new URL(url).pathname === path);
}

beforeEach(async () => {
  vi.resetModules();
  state.map.clear();
  state.map.set(AUTH, tokens());
  state.map.set(REGISTRATION, { userId: A, deviceId: B, endpoint: "https://push.example/device" });
  create = vi.fn().mockResolvedValue("anidachi-room-invites");
  badge = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("chrome", {
    permissions: { contains: async () => true },
    notifications: { create, clear: async () => true },
    action: { setBadgeText: badge, setBadgeBackgroundColor: async () => undefined },
    runtime: { getURL: (path: string) => `chrome-extension://test/${path}` },
  });
  const subscription = { options: { applicationServerKey: new Uint8Array([1, 2, 3]).buffer },
    expirationTime: null, unsubscribe: async () => true,
    toJSON: () => ({ endpoint: "https://push.example/device", keys: { p256dh: "key", auth: "auth" } }) };
  vi.stubGlobal("registration", { pushManager: {
    getSubscription: async () => subscription, subscribe: async () => subscription,
  } });
  http = vi.fn(async (url: URL) => {
    if (new URL(url).pathname === "/api/me") return json({ user: (state.map.get(AUTH) as ExtensionAuthTokens).user });
    if (url.pathname === "/api/account/inbox") return json(inbox());
    return json({ error: "Registration unavailable" }, 503);
  });
  vi.stubGlobal("fetch", http);
  runtime = await import("../src/room-invite-notifications");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("invitation notification runtime", () => {
  it("delivers through authenticated inbox without any /api/me round trip", async () => {
    await runtime.reconcileRoomInviteNotifications({ notify: true });
    expect(create).toHaveBeenCalledOnce();
    expect(requests("/api/me")).toHaveLength(0);
    expect(state.map.get(`local:anidachi.accountInbox.v1.${A}`)).toMatchObject({ userId: A });
    expect(badge).toHaveBeenCalledWith({ text: "1" });
  });

  it("keeps an in-flight invitation across same-account token rotation", async () => {
    const started = deferred<void>();
    const result = deferred<Response>();
    const original = http.getMockImplementation()!;
    http.mockImplementation((url: URL) => {
      if (url.pathname !== "/api/account/inbox") return original(url);
      started.resolve(); return result.promise;
    });
    const run = runtime.reconcileRoomInviteNotifications({ notify: true });
    await started.promise;
    const rotated = tokens(A, "access-2");
    state.map.set(AUTH, rotated);
    const changed = runtime.handleAuthSessionChanged(tokens(), rotated);
    result.resolve(json(inbox()));
    await Promise.all([run, changed]);
    expect(create).toHaveBeenCalledOnce();
  });

  it("rejects an old account response after account switch", async () => {
    const started = deferred<void>();
    const result = deferred<Response>();
    http.mockImplementation(async (url: URL) => {
      if (new URL(url).pathname === "/api/me") return json({ user: (state.map.get(AUTH) as ExtensionAuthTokens).user });
      if (url.pathname !== "/api/account/inbox") return json({ error: "unavailable" }, 503);
      if ((state.map.get(AUTH) as ExtensionAuthTokens).user.id === B) return json(inbox(B, false));
      started.resolve(); return result.promise;
    });
    const run = runtime.reconcileRoomInviteNotifications({ notify: true });
    await started.promise;
    state.map.set(AUTH, tokens(B));
    const changed = runtime.handleAuthSessionChanged(tokens(), tokens(B));
    result.resolve(json(inbox()));
    await Promise.all([run, changed]);
    expect(create).not.toHaveBeenCalled();
    expect(state.map.has(`local:anidachi.accountInbox.v1.${A}`)).toBe(false);
  });

  it("delivers cache, badge and alert even when registration fails", async () => {
    state.map.delete(REGISTRATION);
    await runtime.reconcileRoomInviteNotifications({ notify: true }).catch(() => undefined);
    expect(create).toHaveBeenCalledOnce();
    expect(badge).toHaveBeenCalledWith({ text: "1" });
    expect(state.map.get(`local:anidachi.accountInbox.v1.${A}`)).toMatchObject({ userId: A });
  });

  it("coalesces a burst to active plus trailing and retains notify true", async () => {
    const started = deferred<void>();
    const result = deferred<Response>();
    const original = http.getMockImplementation()!;
    http.mockImplementation((url: URL) => {
      if (url.pathname !== "/api/account/inbox") return original(url);
      started.resolve(); return result.promise;
    });
    const run = runtime.reconcileRoomInviteNotifications({ notify: false });
    await started.promise;
    const burst = Array.from({ length: 8 }, (_, index) =>
      runtime.reconcileRoomInviteNotifications({ notify: index === 0 }));
    result.resolve(json(inbox()));
    // Each HTTP call needs an independently consumable body.
    http.mockImplementation(original);
    await Promise.all([run, ...burst]);
    expect(create).toHaveBeenCalledOnce();
    expect(requests("/api/account/inbox")).toHaveLength(2);
  });

  it("rejects a server response owned by another account", async () => {
    const original = http.getMockImplementation()!;
    http.mockImplementation((url: URL) => url.pathname === "/api/account/inbox"
      ? Promise.resolve(json(inbox(B))) : original(url));
    await expect(runtime.reconcileRoomInviteNotifications({ notify: true })).rejects.toThrow("another account");
    expect(create).not.toHaveBeenCalled();
  });

  it.each(["fetch", "body", "error body"])("bounds stalled inbox %s at 10 seconds without clearing auth", async (stage) => {
    vi.useFakeTimers();
    const started = deferred<void>();
    const original = http.getMockImplementation()!;
    http.mockImplementation((url: URL) => {
      if (url.pathname !== "/api/account/inbox") return original(url);
      started.resolve();
      return stage === "fetch" ? new Promise<Response>(() => {}) : Promise.resolve({
        ok: stage !== "error body", status: stage === "error body" ? 503 : 200,
        json: () => new Promise(() => {}),
      } as Response);
    });
    let failure: unknown;
    const run = runtime.reconcileRoomInviteNotifications({ notify: true }).catch((error) => { failure = error; });
    await started.promise;
    await vi.advanceTimersByTimeAsync(10_001);
    expect(failure).toMatchObject({ code: "INBOX_REQUEST_TIMEOUT" });
    await run;
    expect(state.map.get(AUTH)).toEqual(tokens());
    expect(create).not.toHaveBeenCalled();
  });

  it("refreshes only once on inbox 401 then retries with the new bearer", async () => {
    http.mockImplementation(async (url: URL, init?: RequestInit) => {
      const path = new URL(url).pathname;
      if (path === "/api/me") return json({ user: tokens().user });
      if (path === "/api/extension/auth/refresh") return json({ accessToken: "access-2", refreshToken: "refresh-2" });
      if (path === "/api/account/inbox") return new Headers(init?.headers).get("Authorization") === "Bearer access-2"
        ? json(inbox()) : json({ error: "Unauthorized" }, 401);
      return json({ error: "Unavailable" }, 503);
    });
    await runtime.reconcileRoomInviteNotifications({ notify: true }).catch(() => undefined);
    expect(create).toHaveBeenCalledOnce();
    expect(requests("/api/account/inbox")).toHaveLength(2);
    expect(requests("/api/extension/auth/refresh")).toHaveLength(1);
  });

  it("a stalled registration cannot delay a later inbox notification", async () => {
    state.map.delete(REGISTRATION);
    const started = deferred<void>();
    const registrationResult = deferred<Response>();
    let hasItem = false;
    http.mockImplementation(async (url: URL) => {
      const path = new URL(url).pathname;
      if (path === "/api/me") return json({ user: tokens().user });
      if (path === "/api/devices/push-subscription") { started.resolve(); return registrationResult.promise; }
      return json(inbox(A, hasItem));
    });
    const run = runtime.reconcileRoomInviteNotifications({ notify: true });
    await started.promise;
    hasItem = true;
    const next = runtime.reconcileRoomInviteNotifications({ notify: true });
    await vi.waitFor(() => expect(create).toHaveBeenCalledOnce(), { timeout: 100 });
    registrationResult.resolve(registered());
    await Promise.all([run, next]);
  });

  it("serializes permission cleanup after pending registration so it cannot be restored late", async () => {
    state.map.delete(REGISTRATION);
    const started = deferred<void>();
    const registrationResult = deferred<Response>();
    const original = http.getMockImplementation()!;
    http.mockImplementation((url: URL) => {
      if (url.pathname !== "/api/devices/push-subscription") return original(url);
      started.resolve(); return registrationResult.promise;
    });
    const run = runtime.reconcileRoomInviteNotifications({ notify: true });
    await started.promise;
    const removed = runtime.handleRoomInviteNotificationPermissionRemoved({ permissions: ["notifications"] });
    let registrationPending = true;
    let cleanupRacedRegistration = false;
    chrome.notifications.clear = async () => {
      cleanupRacedRegistration ||= registrationPending;
      return true;
    };
    // Flush the queued cleanup while the controlled HTTP boundary stays pending.
    await new Promise((resolve) => setTimeout(resolve, 0));
    registrationPending = false;
    registrationResult.resolve(registered());
    await Promise.all([run, removed]);
    expect(cleanupRacedRegistration).toBe(false);
    expect(state.map.has(REGISTRATION)).toBe(false);
  });

  it("keeps cached auth/inbox on transient refresh failure and does not retry refresh", async () => {
    const cached = { previous: true };
    state.map.set(`local:anidachi.accountInbox.v1.${A}`, cached);
    http.mockImplementation(async (url: URL) => {
      const path = new URL(url).pathname;
      if (path === "/api/account/inbox") return json({ error: "Unauthorized" }, 401);
      return json({ error: "Unavailable" }, 503);
    });
    await expect(runtime.reconcileRoomInviteNotifications({ notify: true })).rejects.toThrow("temporarily unavailable");
    expect(state.map.get(AUTH)).toEqual(tokens());
    expect(state.map.get(`local:anidachi.accountInbox.v1.${A}`)).toBe(cached);
    expect(requests("/api/extension/auth/refresh")).toHaveLength(1);
    expect(create).not.toHaveBeenCalled();
  });

  it("does not commit stale registration after switching accounts", async () => {
    state.map.delete(REGISTRATION);
    const oldStarted = deferred<void>();
    const newStarted = deferred<void>();
    const oldResult = deferred<Response>();
    const newResult = deferred<Response>();
    http.mockImplementation(async (url: URL, init?: RequestInit) => {
      const current = state.map.get(AUTH) as ExtensionAuthTokens;
      if (url.pathname === "/api/account/inbox") return json(inbox(current.user.id, false));
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      if (url.pathname === "/api/devices/push-subscription") {
        if (current.user.id === A) { oldStarted.resolve(); return oldResult.promise; }
        newStarted.resolve(); return newResult.promise;
      }
      return json({ error: "Unexpected request" }, 500);
    });
    const oldRun = runtime.reconcileRoomInviteNotifications({ notify: true });
    await oldStarted.promise;
    state.map.set(AUTH, tokens(B, "access-B"));
    const changed = runtime.handleAuthSessionChanged(tokens(), tokens(B, "access-B"));
    oldResult.resolve(registered());
    await newStarted.promise;
    expect(state.map.has(REGISTRATION)).toBe(false);
    newResult.resolve(registered());
    await Promise.all([oldRun, changed]);
    expect(state.map.get(REGISTRATION)).toMatchObject({ userId: B });
    expect(create).not.toHaveBeenCalled();
  });
});
