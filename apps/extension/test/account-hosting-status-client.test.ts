import { afterEach, describe, expect, it, vi } from "vitest";
import { handleAccountHostingStatusMessage, requestAccountHostingStatus } from "../src/account-hosting-status-client";

const owner = "11111111-1111-4111-8111-111111111111";
const session = { authRevision: "login-a", accessToken: "token", refreshToken: "refresh", user: { id: owner, email: "test@example.invalid", displayName: "Test", avatarUrl: null, plan: "free" as const } };
const message = { type: "ANIDACHI_ACCOUNT_HOSTING_STATUS" as const, ownerUserId: owner };
const at = Date.parse("2026-11-01T12:00:00Z");
export const accountStatus = { accountHostingVersion: 1 as const, ownerUserId: owner, planCode: "free" as const, serverTime: at, validUntil: at + 60_000, period: { utcDay: "2026-11-01", resetAt: Date.parse("2026-11-02T00:00:00Z") }, access: { kind: "daily_free" as const, budgetSeconds: 1200 as const, usedSeconds: 420, remainingSeconds: 780, metering: false }, activeRoom: null, canCreateRoom: true };
const dependencies = () => ({ getSession: vi.fn().mockResolvedValue(session), refresh: vi.fn().mockResolvedValue(session) });
const legacyAccess = {
  entitlementsVersion: 1, ownerUserId: owner, serverTime: new Date(at).toISOString(), planCode: "free",
  hosting: { hostingPolicyVersion: 2, hostingActivationAt: "2026-10-03T00:00:00Z", canHost: false, trialEligibility: "used", trialEndsAt: null },
};

describe("account hosting status background bridge", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it("reads a fixed private endpoint with owner binding and current credentials", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(accountStatus)); vi.stubGlobal("fetch", fetch);
    expect(await handleAccountHostingStatusMessage(message, dependencies())).toEqual({ ok: true, mode: "free20", status: accountStatus });
    expect(fetch).toHaveBeenCalledWith(new URL("http://localhost:3003/api/me/hosting-status"), expect.objectContaining({ credentials: "omit", cache: "no-store", redirect: "error", headers: { Authorization: "Bearer token", "x-anidachi-hosting-owner": owner } }));
  });
  it.each([404, 503, 200])("does not confuse generic HTTP %s with disabled policy", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "unavailable" }, { status })));
    expect(await handleAccountHostingStatusMessage(message, dependencies())).toEqual({ ok: false });
  });
  it("selects legacy only for explicit disabled policy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code: "FREE20_DISABLED" }, { status: 404 })));
    expect(await handleAccountHostingStatusMessage(message, dependencies())).toEqual({ ok: true, mode: "legacy" });
  });
  it("recognizes the released backend only after a fresh owner-bound legacy authority read", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("<html>Not found</html>", { status: 404 }))
      .mockResolvedValueOnce(Response.json(legacyAccess));
    vi.stubGlobal("fetch", fetch);
    expect(await handleAccountHostingStatusMessage(message, dependencies())).toEqual({ ok: true, mode: "legacy" });
    expect(fetch).toHaveBeenLastCalledWith(new URL("http://localhost:3003/api/me/entitlements?hostingStatusVersion=1"),
      expect.objectContaining({ credentials: "omit", cache: "no-store", redirect: "error", headers: {
        Authorization: "Bearer token", "x-anidachi-hosting-owner": owner, "x-anidachi-history-owner": owner,
      } }));
  });
  it.each([
    { ...legacyAccess, hostingStatusVersion: 1 }, { ...legacyAccess, hostingStatusVersion: null },
    { ...legacyAccess, hostingStatusVersion: 2 }, { ...legacyAccess, ownerUserId: "22222222-2222-4222-8222-222222222222" },
    { ...legacyAccess, hosting: undefined }, { ...legacyAccess, hosting: { ...legacyAccess.hosting, canHost: true } },
  ])("does not downgrade a new, unknown or contradictory authority (%#)", async payload => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, {status: 404})).mockResolvedValueOnce(Response.json(payload)));
    expect(await handleAccountHostingStatusMessage(message, dependencies())).toEqual({ ok: false });
  });
  it.each([403, 428, 503, 200])("does not probe legacy authority after status %s", async status => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({}, {status})).mockResolvedValueOnce(Response.json(legacyAccess));
    vi.stubGlobal("fetch", fetch);
    expect(await handleAccountHostingStatusMessage(message, dependencies())).toEqual({ok: false});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("retires a compatibility response when the login changes in flight", async () => {
    const deps = dependencies();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, {status: 404})).mockImplementationOnce(async () => {
      deps.getSession.mockResolvedValue({...session, authRevision: "another-login"});
      return Response.json(legacyAccess);
    }));
    expect(await handleAccountHostingStatusMessage(message, deps)).toEqual({ok: false});
  });
  it("never downgrades an already confirmed new backend during the same login", async () => {
    const deps = dependencies();
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(accountStatus))
      .mockResolvedValueOnce(new Response(null, {status: 404})).mockResolvedValueOnce(Response.json(legacyAccess));
    vi.stubGlobal("fetch", fetch);
    expect((await handleAccountHostingStatusMessage(message, deps)).ok).toBe(true);
    expect(await handleAccountHostingStatusMessage({...message, fresh: true}, deps)).toEqual({ok: false});
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("a parallel confirmed new status retires an older legacy compatibility probe", async () => {
    const deps = dependencies();
    let completeLegacy!: (response: Response) => void;
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, {status: 404}))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { completeLegacy = resolve; }))
      .mockResolvedValueOnce(Response.json(accountStatus));
    vi.stubGlobal("fetch", fetch);
    const old = handleAccountHostingStatusMessage(message, deps);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect((await handleAccountHostingStatusMessage({...message, fresh: true}, deps)).ok).toBe(true);
    completeLegacy(Response.json(legacyAccess));
    expect(await old).toEqual({ok: false});
  });
  it("uses the rotated background bearer when probing a released backend", async () => {
    const { createFree20AbuseClient } = await import("../src/free20-abuse-client");
    let current = { ...session, authSessionId: "compat-login" };
    const transport = vi.fn(async (url: URL, init: RequestInit) => {
      const headers = new Headers(init.headers);
      if (headers.get("authorization") === "Bearer token") return new Response(null, {status: 401});
      if (url.pathname.endsWith("hosting-status")) return new Response("Not found", {status: 404});
      expect(headers.get("x-anidachi-history-owner")).toBe(owner);
      expect(headers.get("x-anidachi-hosting-owner")).toBe(owner);
      return Response.json(legacyAccess);
    });
    const request = createFree20AbuseClient({baseUrl: "http://localhost:3003", getSession: async () => current,
      refresh: async () => current = {...current, accessToken: "rotated", authRevision: "rotated-revision"},
      sign: async () => { throw new Error("Legacy server does not request enrollment"); }, fetch: transport,
    }).request;
    expect(await handleAccountHostingStatusMessage(message, {getSession: async () => current, refresh: async () => current, request}))
      .toEqual({ok: true, mode: "legacy"});
    expect(transport).toHaveBeenCalledTimes(3);
  });
  it.each(["authRevision", "accessToken", "refreshToken"] as const)("fences late %s session changes", async key => {
    const deps = dependencies(); deps.getSession.mockResolvedValueOnce(session).mockResolvedValue({ ...session, [key]: "changed" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(accountStatus)));
    expect(await handleAccountHostingStatusMessage(message, deps)).toEqual({ ok: false });
  });
  it("starts an independent freshness read instead of reusing another consumer's pending response", async () => {
    const deps = dependencies();
    let resolveOld!: (value: Response) => void, resolveNew!: (value: Response) => void;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveNew = resolve; }));
    vi.stubGlobal("fetch", fetch);
    const oldRead = handleAccountHostingStatusMessage(message, deps);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const freshRead = handleAccountHostingStatusMessage({ ...message, fresh: true }, deps);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    resolveOld(Response.json(accountStatus)); await oldRead;
    const freshStatus = { ...accountStatus, serverTime: at + 5_000 };
    resolveNew(Response.json(freshStatus));
    expect(await freshRead).toEqual({ ok: true, mode: "free20", status: freshStatus });
  });
  it("checks the refreshed session before sending its bearer", async () => {
    const deps = dependencies(); const fresh = { ...session, accessToken: "fresh", refreshToken: "rotated" };
    deps.refresh.mockImplementation(async () => { deps.getSession.mockResolvedValue({ ...fresh, authRevision: "new-login" }); return fresh; });
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 })); vi.stubGlobal("fetch", fetch);
    expect(await handleAccountHostingStatusMessage(message, deps)).toEqual({ ok: false }); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("bounds the body read and rejects cross-owner or malformed bridge payloads", async () => {
    vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, json: () => new Promise(() => {}) }));
    const pending = handleAccountHostingStatusMessage(message, dependencies()); await vi.advanceTimersByTimeAsync(10_000); expect(await pending).toEqual({ ok: false });
    vi.stubGlobal("chrome", { runtime: { sendMessage: async () => ({ ok: true, mode: "free20", status: { ...accountStatus, ownerUserId: "22222222-2222-4222-8222-222222222222" } }) } });
    await expect(requestAccountHostingStatus(owner)).rejects.toThrow();
  });
});

it("routes hosting status through background context enrollment and preserves its same-login refresh", async () => {
  const { createFree20AbuseClient } = await import("../src/free20-abuse-client");
  let current = { ...session, authSessionId: "logical-login" };
  const context = "c".repeat(100) + "." + "a".repeat(43), challenge = "b".repeat(100) + "." + "a".repeat(43);
  let resourceCalls = 0, enrollments = 0;
  const request = createFree20AbuseClient({ baseUrl: "http://localhost:3003", getSession: async () => current,
    refresh: async () => current = { ...current, accessToken: "fresh", authRevision: "r2" },
    sign: async () => ({ version: 1, challenge, publicKey: "a".repeat(124), signature: "a".repeat(86) }),
    fetch: async (url, init) => {
      const headers = new Headers(init.headers);
      if (url.pathname.endsWith("free20-context")) {
        enrollments++; return Response.json(JSON.parse(String(init.body)).action === "challenge" ? { action: "challenge", challenge, expiresAt: Date.now() + 300000 } : { action: "complete", context, expiresAt: Date.now() + 1800000 });
      }
      resourceCalls++;
      if (headers.get("authorization") === "Bearer token") return Response.json({}, { status: 401 });
      return headers.get("x-anidachi-free20-context") === context ? Response.json(accountStatus) : Response.json({}, { status: 428 });
    },
  }).request;
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Bypassed background transport"); }));
  const result = await handleAccountHostingStatusMessage(message, { getSession: async () => current, refresh: async () => current, request });
  expect(result).toEqual({ ok: true, mode: "free20", status: accountStatus });
  expect(resourceCalls).toBe(3); expect(enrollments).toBe(2);
  vi.unstubAllGlobals();
});
