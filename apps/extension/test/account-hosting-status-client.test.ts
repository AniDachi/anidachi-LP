import { afterEach, describe, expect, it, vi } from "vitest";
import { handleAccountHostingStatusMessage, requestAccountHostingStatus } from "../src/account-hosting-status-client";

const owner = "11111111-1111-4111-8111-111111111111";
const session = { authRevision: "login-a", accessToken: "token", refreshToken: "refresh", user: { id: owner, email: "test@example.invalid", displayName: "Test", avatarUrl: null, plan: "free" as const } };
const message = { type: "ANIDACHI_ACCOUNT_HOSTING_STATUS" as const, ownerUserId: owner };
const at = Date.parse("2026-11-01T12:00:00Z");
export const accountStatus = { accountHostingVersion: 1 as const, ownerUserId: owner, planCode: "free" as const, serverTime: at, validUntil: at + 60_000, period: { utcDay: "2026-11-01", resetAt: Date.parse("2026-11-02T00:00:00Z") }, access: { kind: "daily_free" as const, budgetSeconds: 1200 as const, usedSeconds: 420, remainingSeconds: 780, metering: false }, activeRoom: null, canCreateRoom: true };
const dependencies = () => ({ getSession: vi.fn().mockResolvedValue(session), refresh: vi.fn().mockResolvedValue(session) });

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
