import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRoomQuotaStatusMessage, isRoomQuotaStatusMessage, requestRoomQuotaStatus } from "../src/room-quota-status-client";

const owner = "11111111-1111-4111-8111-111111111111";
const message = { type: "ANIDACHI_ROOM_QUOTA_STATUS" as const, ownerUserId: owner, accessToken: "test-token" };
const status = { schemaVersion: 1, ownerUserId: owner, serverTime: "2026-09-15T12:00:00Z", quota: { remainingSeconds: 0, resetAt: "2026-09-16T00:00:00Z" } };
const storedSession = { accessToken: "test-token", refreshToken: "refresh", user: { id: owner, email: "test@example.invalid", displayName: "Test", avatarUrl: null, plan: "free" as const } };
const sessionDeps = () => ({ getSession: vi.fn().mockResolvedValue(storedSession), refresh: vi.fn().mockResolvedValue(storedSession) });
describe("quota status read bridge", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("uses a fixed authenticated, uncached read with no cookie account fallback", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(status))); vi.stubGlobal("fetch", fetch);
    expect(await handleRoomQuotaStatusMessage(message, sessionDeps())).toEqual({ ok: true, status });
    expect(fetch).toHaveBeenCalledWith(new URL("http://localhost:3003/api/me/room-quota"), expect.objectContaining({ cache: "no-store", credentials: "omit", headers: { Authorization: "Bearer test-token", "x-anidachi-quota-owner": owner } }));
    expect(isRoomQuotaStatusMessage(message)).toBe(true);
    expect(isRoomQuotaStatusMessage({ ...message, accessToken: "" })).toBe(false);
  });
  it.each([new Response("{}", { status: 503 }), new Response(JSON.stringify({ ...status, ownerUserId: "22222222-2222-4222-8222-222222222222" })), new Response(JSON.stringify({ ...status, serverTime: "bad" }))])("fails closed on errors or mismatched data (%#)", async response => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    expect(await handleRoomQuotaStatusMessage(message, sessionDeps())).toEqual({ ok: false });
  });
  it("refreshes an expired token for the same stored owner after a long countdown", async () => {
    const stored = { ...storedSession, accessToken: "expired" };
    const refreshed = { ...stored, accessToken: "fresh" };
    const deps = { getSession: vi.fn().mockResolvedValue(stored), refresh: vi.fn().mockImplementation(async () => { deps.getSession.mockResolvedValue(refreshed); return refreshed; }) };
    const fetch = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 401 })).mockResolvedValueOnce(new Response(JSON.stringify(status)));
    vi.stubGlobal("fetch", fetch);
    expect(await handleRoomQuotaStatusMessage(message, deps)).toEqual({ ok: true, status });
    expect(deps.refresh).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[1]?.[1].headers.Authorization).toBe("Bearer fresh");
  });
  it("rejects stale requests and responses after logout or account switch", async () => {
    const deps = sessionDeps(); deps.getSession.mockResolvedValue(null);
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await handleRoomQuotaStatusMessage(message, deps)).toEqual({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
    deps.getSession.mockResolvedValueOnce(storedSession).mockResolvedValue(null);
    fetch.mockResolvedValue(new Response(JSON.stringify(status)));
    expect(await handleRoomQuotaStatusMessage(message, deps)).toEqual({ ok: false });
  });
  it("bounds a hung request even when fetch never settles", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
      const pending = handleRoomQuotaStatusMessage(message, sessionDeps());
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await pending).toEqual({ ok: false });
    } finally { vi.useRealTimers(); }
  });
  it("revalidates ownership across the runtime bridge", async () => {
    vi.stubGlobal("chrome", { runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: true, status }) } });
    expect(await requestRoomQuotaStatus(owner, "test-token")).toEqual(status);
    await expect(requestRoomQuotaStatus("other-owner", "test-token")).rejects.toThrow("Quota owner changed");
  });
});
