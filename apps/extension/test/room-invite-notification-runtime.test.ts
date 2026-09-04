import type { AccountInboxResponse } from "@anidachi/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAuthTokens } from "../src/auth-tokens";

const state = vi.hoisted(() => ({ map: new Map<string, unknown>() }));
vi.mock("wxt/utils/storage", () => ({ storage: {
  getItem: async (key: string) => structuredClone(state.map.get(key) ?? null),
  setItem: async (key: string, value: unknown) => { state.map.set(key, structuredClone(value)); },
  removeItem: async (key: string) => { state.map.delete(key); },
} }));
vi.mock("../src/constants", async (original) => ({
  ...await original<object>(), WXT_VAPID_PUBLIC_KEY: "AQID",
}));

const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
const AUTH = "local:authTokens";
const REGISTRATION = "local:anidachi.roomInviteNotifications.registration";
const RETRY = "local:anidachi.roomInviteNotifications.retry.v1";
const RETRY_ALARM = "anidachi-room-invite-notifications-retry";
const PREFERENCE = "local:anidachi.roomInviteNotifications.enabled";
const alarms = new Map<string, chrome.alarms.AlarmCreateInfo>();
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
  alarms.clear();
  state.map.set(AUTH, tokens());
  state.map.set(REGISTRATION, { userId: A, deviceId: B, endpoint: "https://push.example/device", verifiedAt: Date.now() });
  create = vi.fn().mockResolvedValue("anidachi-room-invites");
  badge = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("chrome", {
    alarms: {
      get: async (name: string) => alarms.get(name),
      create: async (name: string, info: chrome.alarms.AlarmCreateInfo) => { alarms.set(name, info); },
      clear: async (name: string) => alarms.delete(name),
    },
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
  it("persists ownership and the first recovery alarm before starting inbox HTTP", async () => {
    const original = http.getMockImplementation()!;
    http.mockImplementation(async (url) => {
      if (url.pathname === "/api/account/inbox") {
        expect(state.map.get(RETRY)).toMatchObject({ userId: A, inbox: { notify: true, attempts: 1 } });
        expect(alarms.get(RETRY_ALARM)?.when).toBeGreaterThanOrEqual(Date.now() + 29_000);
        throw new Error("offline");
      }
      return original(url);
    });
    await expect(runtime.reconcileRoomInviteNotifications({ notify: true })).rejects.toThrow("offline");
  });

  it("recovers badge and one alert after losing all module globals, then dedupes another push", async () => {
    vi.useFakeTimers();
    const original = http.getMockImplementation()!;
    http.mockImplementation(async (url) => {
      if (url.pathname === "/api/account/inbox") throw new Error("offline");
      return original(url);
    });
    await expect(runtime.reconcileRoomInviteNotifications({ notify: true })).rejects.toThrow("offline");
    expect(state.map.get(RETRY)).toMatchObject({ userId: A, inbox: { notify: true } });
    vi.resetModules();
    runtime = await import("../src/room-invite-notifications");
    http.mockImplementation(original);
    await vi.advanceTimersByTimeAsync(30_000);
    await runtime.handleRoomInviteNotificationRetryAlarm(RETRY_ALARM);
    expect(create).toHaveBeenCalledOnce();
    expect(badge).toHaveBeenCalledWith({ text: "1" });
    expect(state.map.get(`local:anidachi.accountInbox.v1.${A}`)).toMatchObject({ userId: A });
    expect(state.map.has(RETRY)).toBe(false);
    await runtime.handleRoomInvitePush({ data: { text: () => '{"type":"inbox_changed"}' } });
    expect(create).toHaveBeenCalledOnce();
  });

  it("registration failure survives inbox success and registration-only recovery stays silent", async () => {
    vi.useFakeTimers();
    state.map.delete(REGISTRATION);
    await runtime.reconcileRoomInviteNotifications({ notify: false });
    expect(state.map.get(RETRY)).toMatchObject({ userId: A, subscription: { attempts: 1 } });
    expect((state.map.get(RETRY) as { inbox?: unknown }).inbox).toBeUndefined();
    vi.resetModules();
    runtime = await import("../src/room-invite-notifications");
    http.mockImplementation(async () => registered());
    http.mockClear();
    await vi.advanceTimersByTimeAsync(30_000);
    await runtime.restoreRoomInviteNotificationRetries();
    expect(requests("/api/account/inbox")).toHaveLength(0);
    expect(requests("/api/devices/push-subscription")).toHaveLength(1);
    expect(state.map.has(RETRY)).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("registration succeeds independently when inbox fails", async () => {
    state.map.delete(REGISTRATION);
    http.mockImplementation(async (url) => {
      if (url.pathname === "/api/account/inbox") throw new Error("offline");
      return registered();
    });
    await expect(runtime.reconcileRoomInviteNotifications({ notify: true })).rejects.toThrow("offline");
    expect(state.map.get(REGISTRATION)).toMatchObject({ userId: A, verifiedAt: expect.any(Number) });
    expect(state.map.get(RETRY)).toMatchObject({ inbox: { notify: true } });
    expect((state.map.get(RETRY) as { subscription?: unknown }).subscription).toBeUndefined();
  });

  it.each(["preference", "permission"])("recovers durable inbox with %s disabled but never alerts or registers", async (disabled) => {
    vi.useFakeTimers();
    const original = http.getMockImplementation()!;
    http.mockRejectedValue(new Error("offline"));
    await runtime.reconcileRoomInviteNotifications({ notify: true }).catch(() => undefined);
    if (disabled === "preference") state.map.set(PREFERENCE, false);
    else chrome.permissions.contains = async () => false;
    http.mockImplementation(original);
    http.mockClear();
    await vi.advanceTimersByTimeAsync(30_000);
    await runtime.restoreRoomInviteNotificationRetries();
    expect(badge).toHaveBeenCalledWith({ text: "1" });
    expect(state.map.get(`local:anidachi.accountInbox.v1.${A}`)).toMatchObject({ userId: A });
    expect(create).not.toHaveBeenCalled();
    expect(requests("/api/devices/push-subscription")).toHaveLength(0);
    expect(state.map.has(RETRY)).toBe(false);
  });

  it("drops stale retry ownership on cold account switch and logout without requesting old data", async () => {
    http.mockRejectedValue(new Error("offline"));
    await runtime.reconcileRoomInviteNotifications({ notify: true }).catch(() => undefined);
    expect(state.map.has(RETRY)).toBe(true);
    state.map.set(AUTH, tokens(B));
    vi.resetModules();
    runtime = await import("../src/room-invite-notifications");
    http.mockClear();
    await runtime.restoreRoomInviteNotificationRetries();
    expect(http).not.toHaveBeenCalled();
    expect(state.map.has(RETRY)).toBe(false);
    await runtime.reconcileRoomInviteNotifications({ notify: true }).catch(() => undefined);
    state.map.delete(AUTH);
    await runtime.restoreRoomInviteNotificationRetries();
    expect(state.map.has(RETRY)).toBe(false);
  });

  it.each(["legacy", "expired", "fresh"])("repairs %s matching registration only when verification is due", async (kind) => {
    const registration = { userId: A, deviceId: B, endpoint: "https://push.example/device" };
    state.map.set(REGISTRATION, kind === "legacy" ? registration : {
      ...registration, verifiedAt: Date.now() - (kind === "expired" ? 86_400_000 : 86_399_000),
    });
    const original = http.getMockImplementation()!;
    http.mockImplementation(async (url) => url.pathname === "/api/devices/push-subscription" ? registered() : original(url));
    await runtime.reconcileRoomInviteNotifications({ notify: false });
    expect(requests("/api/devices/push-subscription")).toHaveLength(kind === "fresh" ? 0 : 1);
    expect(state.map.get(REGISTRATION)).toMatchObject({ verifiedAt: expect.any(Number) });
  });

  it("bounds recovery to eight total attempts, preserves backoff across starts, and permits new external work", async () => {
    vi.useFakeTimers();
    http.mockRejectedValue(new Error("offline"));
    await runtime.reconcileRoomInviteNotifications({ notify: true }).catch(() => undefined);
    for (const delay of [30_000, 60_000, 120_000, 240_000, 480_000, 960_000, 1_920_000]) {
      expect(alarms.get(RETRY_ALARM)?.when).toBe(Date.now() + delay);
      await runtime.restoreRoomInviteNotificationRetries();
      await vi.advanceTimersByTimeAsync(delay);
      await runtime.handleRoomInviteNotificationRetryAlarm(RETRY_ALARM).catch(() => undefined);
    }
    expect(requests("/api/account/inbox")).toHaveLength(8);
    await vi.advanceTimersByTimeAsync(3_600_000);
    await runtime.restoreRoomInviteNotificationRetries();
    expect(requests("/api/account/inbox")).toHaveLength(8);
    expect(state.map.has(RETRY)).toBe(false);
    expect(alarms.has(RETRY_ALARM)).toBe(false);
    await runtime.reconcileRoomInviteNotifications({ notify: true }).catch(() => undefined);
    expect(requests("/api/account/inbox")).toHaveLength(9);
  });

  it("expires retry work at 24 hours even if few attempts ran", async () => {
    vi.useFakeTimers();
    http.mockRejectedValue(new Error("offline"));
    await runtime.reconcileRoomInviteNotifications({ notify: true }).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(86_400_000);
    await runtime.restoreRoomInviteNotificationRetries();
    expect(requests("/api/account/inbox")).toHaveLength(1);
    expect(state.map.has(RETRY)).toBe(false);
    expect(alarms.has(RETRY_ALARM)).toBe(false);
  });

  it("an older inbox completion cannot acknowledge a newer failed invalidation", async () => {
    const started = deferred<void>();
    const result = deferred<Response>();
    http.mockImplementation(async () => {
      started.resolve();
      return result.promise;
    });
    const first = runtime.reconcileRoomInviteNotifications({ notify: false });
    const firstSettled = first.catch(() => undefined);
    await started.promise;
    const firstId = (state.map.get(RETRY) as { inbox: { id: string } }).inbox.id;
    const second = runtime.reconcileRoomInviteNotifications({ notify: true });
    const secondSettled = second.catch(() => undefined);
    await vi.waitFor(() => expect((state.map.get(RETRY) as { inbox: { id: string } }).inbox.id).not.toBe(firstId));
    http.mockRejectedValue(new Error("offline"));
    result.resolve(json(inbox()));
    await Promise.all([firstSettled, secondSettled]);
    expect(state.map.get(RETRY)).toMatchObject({ inbox: { notify: true, attempts: 1 } });
    expect(create).toHaveBeenCalledOnce();
    const originalId = (state.map.get(RETRY) as { inbox: { id: string } }).inbox.id;
    const rotated = tokens(A, "access-2");
    state.map.set(AUTH, rotated);
    await runtime.handleAuthSessionChanged(tokens(), rotated);
    expect((state.map.get(RETRY) as { inbox: { id: string } }).inbox.id).toBe(originalId);
  });

  it("an older subscription completion preserves a newer pending inbox alert", async () => {
    state.map.delete(REGISTRATION);
    const started = deferred<void>();
    const result = deferred<Response>();
    let inboxOffline = false;
    http.mockImplementation(async (url) => {
      if (url.pathname === "/api/devices/push-subscription") {
        expect(state.map.get(RETRY)).toMatchObject({ subscription: { attempts: 1 } });
        expect(alarms.has(RETRY_ALARM)).toBe(true);
        started.resolve();
        return result.promise;
      }
      if (inboxOffline) throw new Error("offline");
      return json(inbox());
    });
    const first = runtime.reconcileRoomInviteNotifications({ notify: false });
    await started.promise;
    inboxOffline = true;
    const second = runtime.reconcileRoomInviteNotifications({ notify: true }).catch(() => undefined);
    await vi.waitFor(() => expect(requests("/api/account/inbox")).toHaveLength(2));
    result.resolve(registered());
    await Promise.all([first, second]);
    expect(state.map.get(RETRY)).toMatchObject({ inbox: { notify: true } });
    expect((state.map.get(RETRY) as { subscription?: unknown }).subscription).toBeUndefined();
    expect(create).not.toHaveBeenCalled();
  });

  it("recreates a lost browser alarm at startup without renewing or prematurely running the retry", async () => {
    vi.useFakeTimers();
    http.mockRejectedValue(new Error("offline"));
    await runtime.reconcileRoomInviteNotifications({ notify: true }).catch(() => undefined);
    const saved = structuredClone(state.map.get(RETRY));
    alarms.clear();
    vi.resetModules();
    runtime = await import("../src/room-invite-notifications");
    await runtime.restoreRoomInviteNotificationRetries();
    expect(state.map.get(RETRY)).toEqual(saved);
    expect(alarms.get(RETRY_ALARM)).toEqual({ when: Date.now() + 30_000 });
    expect(requests("/api/account/inbox")).toHaveLength(1);
  });

  it("caps the final wakeup delay at one hour before retiring exhausted work", async () => {
    vi.useFakeTimers();
    http.mockRejectedValue(new Error("offline"));
    await runtime.reconcileRoomInviteNotifications({ notify: true }).catch(() => undefined);
    for (const delay of [30_000, 60_000, 120_000, 240_000, 480_000, 960_000, 1_920_000]) {
      await vi.advanceTimersByTimeAsync(delay);
      await runtime.restoreRoomInviteNotificationRetries();
    }
    expect(alarms.get(RETRY_ALARM)).toEqual({ when: Date.now() + 3_600_000 });
    expect(requests("/api/account/inbox")).toHaveLength(8);
  });

  it("a hung global auth refresh hits the caller deadline while a subsequent valid-token pass still works", async () => {
    vi.useFakeTimers();
    const refreshing = deferred<void>();
    http.mockImplementation(async (url, init) => {
      const path = new URL(url).pathname;
      if (path === "/api/extension/auth/refresh") {
        refreshing.resolve();
        return new Promise<Response>(() => {});
      }
      if (path === "/api/account/inbox") {
        return new Headers(init?.headers).get("Authorization") === "Bearer access-2"
          ? json(inbox()) : json({ error: "Unauthorized" }, 401);
      }
      return registered();
    });
    let failure: unknown;
    const first = runtime.reconcileRoomInviteNotifications({ notify: true }).catch((error) => { failure = error; });
    await refreshing.promise;
    await vi.advanceTimersByTimeAsync(10_001);
    await first;
    expect(failure).toBeInstanceOf(Error);
    expect(state.map.get(AUTH)).toEqual(tokens());
    const rotated = tokens(A, "access-2");
    state.map.set(AUTH, rotated);
    await runtime.handleAuthSessionChanged(tokens(), rotated);
    await runtime.reconcileRoomInviteNotifications({ notify: true });
    expect(create).toHaveBeenCalledOnce();
    expect(badge).toHaveBeenCalledWith({ text: "1" });
    expect(requests("/api/extension/auth/refresh")).toHaveLength(1);
  });

  it("registration-only recovery refreshes an expired bearer once on 401 without fetching or alerting inbox", async () => {
    vi.useFakeTimers();
    state.map.delete(REGISTRATION);
    await runtime.reconcileRoomInviteNotifications({ notify: false });
    http.mockClear();
    http.mockImplementation(async (url, init) => {
      const path = new URL(url).pathname;
      if (path === "/api/extension/auth/refresh") return json({ accessToken: "access-2", refreshToken: "refresh-2" });
      if (path === "/api/me") return json({ user: tokens().user });
      if (path === "/api/devices/push-subscription") {
        return new Headers(init?.headers).get("Authorization") === "Bearer access-2"
          ? registered() : json({ error: "Unauthorized" }, 401);
      }
      throw new Error(`Unexpected request ${path}`);
    });
    await vi.advanceTimersByTimeAsync(30_000);
    await runtime.restoreRoomInviteNotificationRetries();
    expect(requests("/api/devices/push-subscription")).toHaveLength(2);
    expect(requests("/api/extension/auth/refresh")).toHaveLength(1);
    expect(requests("/api/account/inbox")).toHaveLength(0);
    expect(state.map.get(REGISTRATION)).toMatchObject({ verifiedAt: expect.any(Number) });
    expect(state.map.has(RETRY)).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it.each(["unauthorized-again", "refresh-unavailable", "refresh-hung"])(
    "keeps bounded silent registration work when auth recovery is %s", async (failureMode) => {
      vi.useFakeTimers();
      state.map.delete(REGISTRATION);
      await runtime.reconcileRoomInviteNotifications({ notify: false });
      const saved = (state.map.get(RETRY) as { subscription: { id: string; createdAt: number } }).subscription;
      http.mockClear();
      const refreshing = deferred<void>();
      http.mockImplementation(async (url) => {
        const path = new URL(url).pathname;
        if (path === "/api/extension/auth/refresh") {
          refreshing.resolve();
          if (failureMode === "refresh-hung") return new Promise<Response>(() => {});
          if (failureMode === "refresh-unavailable") return json({ error: "Unavailable" }, 503);
          return json({ accessToken: "access-2", refreshToken: "refresh-2" });
        }
        if (path === "/api/me") return json({ user: tokens().user });
        return json({ error: "Unauthorized" }, 401);
      });
      await vi.advanceTimersByTimeAsync(30_000);
      const recovery = runtime.restoreRoomInviteNotificationRetries();
      await refreshing.promise;
      if (failureMode === "refresh-hung") await vi.advanceTimersByTimeAsync(10_001);
      await recovery;
      expect(requests("/api/extension/auth/refresh")).toHaveLength(1);
      expect(requests("/api/devices/push-subscription")).toHaveLength(failureMode === "unauthorized-again" ? 2 : 1);
      expect(state.map.get(RETRY)).toMatchObject({ subscription: {
        id: saved.id, createdAt: saved.createdAt, attempts: 2, notify: false,
      } });
      expect(state.map.has(REGISTRATION)).toBe(false);
      expect(create).not.toHaveBeenCalled();
    },
  );

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
