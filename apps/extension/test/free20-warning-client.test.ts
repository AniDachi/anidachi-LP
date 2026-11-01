import { afterEach, describe, expect, it, vi } from "vitest";
import { createFree20WarningClient, isFree20WarningMessage } from "../src/free20-warning-client";
import type { ExtensionAuthTokens } from "../src/auth-tokens";
import { AUTH_TOKENS_KEY, getBackgroundAuthSession } from "../src/auth-tokens";

const authStorage = vi.hoisted(() => new Map<string, unknown>());
vi.mock("wxt/utils/storage", () => ({ storage: {
  getItem: async (key: string) => authStorage.get(key) ?? null,
  setItem: async (key: string, value: unknown) => { authStorage.set(key, structuredClone(value)); },
} }));

const owner = "11111111-1111-4111-8111-111111111111";
const at = Date.parse("2026-11-01T12:00:00Z");
const initial: ExtensionAuthTokens = { authSessionId: "login-a", authRevision: "revision-a", accessToken: "secret-access", refreshToken: "secret-refresh", user: { id: owner, email: "a@example.invalid", displayName: "A", avatarUrl: null, plan: "free" } };
const loginKey = JSON.stringify([owner, "login", "login-a"]);
const request = { hostingWarningVersion: 1 as const, roomId: "room", roomGeneration: 1, utcDay: "2026-11-01" };
const message = (reason: "initial" | "retry" | "crossing" = "initial", sequence = 1) => ({ type: "ANIDACHI_FREE20_WARNING" as const, command: "claim" as const, requestId: crypto.randomUUID(), ownerUserId: owner, loginKey, credentialRevision: "revision-a", reason, snapshotSequence: sequence, request });
const body = (decision: "show" | "not_eligible" | "already_claimed" = "show") => ({ ...request, ownerUserId: owner, serverTime: at, validUntil: at + 10_000, decision, ...(decision === "show" ? { thresholdSeconds: 300, claimId: crypto.randomUUID() } : {}) });

function setup() {
  let session: ExtensionAuthTokens | null = structuredClone(initial);
  let stored: unknown;
  let now = at;
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body())));
  const refresh = vi.fn(async (_expected: ExtensionAuthTokens) => session);
  const dependencies = { getSession: async () => session, refresh, fetch: fetcher, now: () => now, read: async () => stored, write: async (value: unknown) => { stored = structuredClone(value); } };
  return { dependencies, client: createFree20WarningClient(dependencies), fetcher, refresh, setSession: (next: ExtensionAuthTokens | null) => { session = next; }, advance: () => { now += 5_000; }, stored: () => stored };
}
afterEach(() => { vi.restoreAllMocks(); authStorage.clear(); });
describe("background Free20 warning claim budget", () => {
  it("serializes racing tabs without broadcasting the winning show promise", async () => {
    const s = setup();
    const results = await Promise.all([s.client(message()), s.client(message())]);
    expect(results.map(result => result.kind).sort()).toEqual(["server", "suppressed"]);
    expect(s.fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(s.stored())).not.toMatch(/secret-access|secret-refresh|claimId/);
    const restarted = createFree20WarningClient(s.dependencies);
    expect(await restarted(message())).toEqual({ kind: "suppressed" });
    expect(await restarted(message("retry"))).toEqual({ kind: "suppressed" });
  });
  it("allows one transient retry after five seconds, surviving worker recreation and refresh", async () => {
    const s = setup(); s.fetcher.mockRejectedValueOnce(new Error("reply lost"));
    expect(await s.client(message())).toEqual({ kind: "failed", retryable: true });
    const restarted = createFree20WarningClient(s.dependencies);
    expect(await restarted(message("retry"))).toEqual({ kind: "suppressed" });
    s.advance(); s.setSession({ ...initial, authRevision: "revision-b", accessToken: "new-access", refreshToken: "new-refresh" });
    const retry = { ...message("retry"), credentialRevision: "revision-b" };
    expect((await restarted(retry)).kind).toBe("server");
    s.advance(); expect(await restarted(retry)).toEqual({ kind: "suppressed" });
    expect(s.fetcher).toHaveBeenCalledTimes(2);
  });
  it("arms only one newer trusted crossing after not_eligible, within two attempts", async () => {
    const s = setup(); s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(body("not_eligible"))));
    expect((await s.client(message())).kind).toBe("server");
    s.advance();
    expect(await s.client(message("retry"))).toEqual({ kind: "suppressed" });
    expect(await s.client(message("crossing", 1))).toEqual({ kind: "suppressed" });
    expect((await s.client(message("crossing", 2))).kind).toBe("server");
    s.advance(); expect(await s.client(message("crossing", 3))).toEqual({ kind: "suppressed" });
    expect(s.fetcher).toHaveBeenCalledTimes(2);
  });
  it.each(["room", "generation"])("allows a lower-sequence crossing in a new %s without resetting the persisted two-attempt budget", async change => {
    const s = setup(); s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(body("not_eligible"))));
    expect((await s.client(message("initial", 50))).kind).toBe("server"); s.advance();
    // The same sequence domain still requires a strictly newer observation.
    expect(await s.client(message("crossing", 50))).toEqual({ kind: "suppressed" });
    expect(await s.client(message("crossing", 49))).toEqual({ kind: "suppressed" });
    const nextRequest = { ...request, ...(change === "room" ? { roomId: "room-b" } : { roomGeneration: 2 }) };
    s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ...body(), ...nextRequest })));
    const restarted = createFree20WarningClient(s.dependencies);
    expect((await restarted({ ...message("crossing", 1), request: nextRequest })).kind).toBe("server");
    expect(s.fetcher).toHaveBeenCalledTimes(2); s.advance();
    expect(await restarted({ ...message("crossing", 2), request: nextRequest })).toEqual({ kind: "suppressed" });
    expect(await restarted(message("crossing", 51))).toEqual({ kind: "suppressed" });
    expect((s.stored() as { attempts: number }[])[0].attempts).toBe(2);
  });
  it("retains exhausted attempt budgets written before stream provenance was added", async () => {
    const s = setup();
    await s.dependencies.write([{ ownerUserId: owner, loginId: initial.authSessionId, utcDay: request.utcDay, attempts: 2, lastAttempt: at - 5000, sequence: 50, next: "crossing" }]);
    const restarted = createFree20WarningClient(s.dependencies);
    expect(await restarted(message())).toEqual({ kind: "suppressed" });
    expect(await restarted({ ...message("crossing", 1), request: { ...request, roomId: "room-b" } })).toEqual({ kind: "suppressed" });
    expect(s.fetcher).not.toHaveBeenCalled();
  });
  it("uses guarded same-login 401 refresh and rejects a new login before any resend", async () => {
    const s = setup(); s.fetcher.mockResolvedValueOnce(new Response("", { status: 401 }));
    const rotated = { ...initial, authRevision: "revision-b", accessToken: "rotated" };
    s.refresh.mockImplementation(async expected => { expect(expected).toEqual(initial); s.setSession(rotated); return rotated; });
    expect((await s.client(message())).kind).toBe("server"); expect(s.fetcher).toHaveBeenCalledTimes(2);
    const other = setup(); other.fetcher.mockResolvedValueOnce(new Response("", { status: 401 }));
    other.refresh.mockImplementation(async () => { const relogin = { ...rotated, authSessionId: "login-b" }; other.setSession(relogin); return relogin; });
    expect(await other.client(message())).toEqual({ kind: "failed", retryable: false });
    expect(other.fetcher).toHaveBeenCalledTimes(1);
  });
  it("fences old credentials, owner, room/day replies and scope cancellation", async () => {
    const s = setup();
    expect(await s.client({ ...message(), credentialRevision: "old" })).toEqual({ kind: "failed", retryable: false });
    s.fetcher.mockImplementationOnce(async () => { s.setSession({ ...initial, authSessionId: "new-login" }); return new Response(JSON.stringify(body())); });
    expect(await s.client(message())).toEqual({ kind: "failed", retryable: false });
    const wrong = setup(); wrong.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ...body(), roomId: "other" })));
    expect(await wrong.client(message())).toEqual({ kind: "failed", retryable: false });
    const cancelled = setup(); const own = message();
    cancelled.fetcher.mockImplementationOnce(async (_url, init) => {
      await cancelled.client({ type: own.type, command: "cancel", requestId: own.requestId, ownerUserId: owner, loginKey });
      expect(init?.signal?.aborted).toBe(true);
      return new Response(JSON.stringify(body()));
    });
    expect(await cancelled.client(own)).toEqual({ kind: "failed", retryable: false });
  });
  it("prunes stale session metadata and caps retained entries", async () => {
    const s = setup();
    for (let index = 0; index < 40; index++) {
      const id = `login-${index}`; s.setSession({ ...initial, authSessionId: id });
      s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(body("already_claimed"))));
      await s.client({ ...message(), loginKey: JSON.stringify([owner, "login", id]) });
    }
    expect((s.stored() as unknown[]).length).toBeLessThanOrEqual(32);
    s.setSession(initial);
    const nextDay = { ...request, utcDay: "2026-11-02" };
    s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ...body(), ...nextDay, serverTime: at + 86400000, validUntil: at + 86410000 })));
    expect((await s.client({ ...message(), request: nextDay })).kind).toBe("server");
    expect((s.stored() as { utcDay: string }[]).every(entry => entry.utcDay === "2026-11-02")).toBe(true);
  });
  it("strictly rejects bridge payloads carrying arbitrary keys or legacy credential keys", () => {
    expect(isFree20WarningMessage(message())).toBe(true);
    expect(isFree20WarningMessage({ ...message(), token: "no" })).toBe(false);
    expect(isFree20WarningMessage({ ...message(), loginKey: JSON.stringify([owner, "credentials", "secret"]) })).toBe(false);
  });
  it("uses the existing durable migration before warning eligibility without copying bearer metadata", async () => {
    const { authSessionId: _oldId, ...legacy } = initial;
    authStorage.set(AUTH_TOKENS_KEY, legacy);
    const migrated = (await getBackgroundAuthSession())!;
    expect(migrated.authSessionId).toEqual(expect.any(String));
    expect(migrated.accessToken).toBe(legacy.accessToken);
    expect(migrated.refreshToken).toBe(legacy.refreshToken);
    const s = setup();
    const client = createFree20WarningClient({ ...s.dependencies, getSession: getBackgroundAuthSession });
    expect((await client({ ...message(), loginKey: JSON.stringify([owner, "login", migrated.authSessionId]) })).kind).toBe("server");
    expect(JSON.stringify(s.stored())).not.toMatch(/secret-access|secret-refresh/);
    expect((await getBackgroundAuthSession())?.authSessionId).toBe(migrated.authSessionId);
  });
  it("does not let a stale prior-day document or completion prune the next day's budget", async () => {
    const s = setup(); const old = message();
    let resolve!: (response: Response) => void;
    s.fetcher.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const previous = s.client(old);
    await vi.waitFor(() => expect(s.fetcher).toHaveBeenCalledTimes(1));
    const nextRequest = { ...request, utcDay: "2026-11-02" };
    s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ...body(), ...nextRequest, serverTime: at + 86400000, validUntil: at + 86410000 })));
    const next = { ...message(), request: nextRequest };
    expect((await s.client(next)).kind).toBe("server");
    resolve(new Response(JSON.stringify(body()))); await previous;
    expect(await s.client(message())).toEqual({ kind: "suppressed" });
    expect(await createFree20WarningClient(s.dependencies)(next)).toEqual({ kind: "suppressed" });
    expect((s.stored() as { utcDay: string }[]).every(entry => entry.utcDay === "2026-11-02")).toBe(true);
  });
});
