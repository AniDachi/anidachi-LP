import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_HOSTING_OWNER_HEADER, FREE20_CONTEXT_HEADER } from "@anidachi/protocol";
import { createFree20AbuseClient } from "../src/free20-abuse-client";
import type { ExtensionAuthTokens } from "../src/auth-tokens";
const owner = "11111111-1111-4111-8111-111111111111";
const session = (id = owner, login = "login-a"): ExtensionAuthTokens => ({ authSessionId: login, authRevision: login, accessToken: `access-${login}`, refreshToken: `refresh-${login}`, user: { id, email: "test@example.invalid", displayName: "Test", avatarUrl: null, plan: "free" } });
const token = (letter: string) => letter.repeat(100) + "." + "a".repeat(43);
const context = token("c"), challenge = token("b");
const proof = { version: 1 as const, challenge, publicKey: "a".repeat(124), signature: "a".repeat(86) };
function fixture() {
  let current: ExtensionAuthTokens | null = session();
  const resource: Headers[] = [], enrollment: RequestInit[] = [];
  const transport = vi.fn(async (url: URL, init: RequestInit) => {
    if (url.pathname === "/api/me/free20-context") {
      enrollment.push(init);
      return Response.json(JSON.parse(String(init.body)).action === "challenge"
        ? { action: "challenge", challenge, expiresAt: Date.now() + 300_000 }
        : { action: "complete", context, expiresAt: Date.now() + 1_800_000 });
    }
    const headers = new Headers(init.headers); resource.push(headers);
    return headers.has(FREE20_CONTEXT_HEADER) ? Response.json({ remainingSeconds: 480 }) : Response.json({ code: "FREE20_CONTEXT_REQUIRED" }, { status: 428 });
  });
  const sign = vi.fn(async () => proof);
  const refresh = vi.fn(async () => current);
  const client = createFree20AbuseClient({ baseUrl: "https://staging.anidachi.app", getSession: async () => current, refresh, sign, fetch: transport });
  const request = (signal?: AbortSignal) => client.request(new URL("https://staging.anidachi.app/api/me/hosting-status"), { headers: { Authorization: `Bearer ${current?.accessToken}`, [ACCOUNT_HOSTING_OWNER_HEADER]: current?.user.id ?? owner }, signal });
  return { client, request, transport, sign, refresh, resource, enrollment, get current() { return current; }, set current(value) { current = value; } };
}
afterEach(() => { vi.useRealTimers(); });
describe("background Free20 context transport", () => {
  it("enrolls only after 428 with owner, include cookies and no synthetic Origin; caches for the login", async () => {
    const f = fixture();
    expect(await (await f.request()).json()).toEqual({ remainingSeconds: 480 });
    expect(f.enrollment).toHaveLength(2);
    for (const init of f.enrollment) {
      expect(init.credentials).toBe("include");
      const headers = new Headers(init.headers);
      expect(headers.get(ACCOUNT_HOSTING_OWNER_HEADER)).toBe(owner);
      expect(headers.get("authorization")).toBe("Bearer access-login-a");
      expect(headers.has("origin")).toBe(false);
    }
    expect(f.resource).toHaveLength(2);
    await f.request(); expect(f.enrollment).toHaveLength(2);
    expect(f.resource[2].get(FREE20_CONTEXT_HEADER)).toBe(context);
  });
  it.each([200, 409, 503])("paid/guest success and HTTP %s never trigger enrollment", async status => {
    const f = fixture(); f.transport.mockImplementation(async () => Response.json({}, { status }));
    expect((await f.request()).status).toBe(status); expect(f.sign).not.toHaveBeenCalled();
  });
  it("has one enrollment and one 428 retry, even when server rejects the new context", async () => {
    const f = fixture(); const original = f.transport.getMockImplementation()!;
    f.transport.mockImplementation(async (url, init) => url.pathname.endsWith("free20-context") ? original(url, init) : Response.json({}, { status: 428 }));
    expect((await f.request()).status).toBe(428);
    expect(f.enrollment).toHaveLength(2); expect(f.transport).toHaveBeenCalledTimes(4);
  });
  it("returns explicit retryable enrollment failure if completion cannot observe the cookie", async () => {
    const f = fixture(); const original = f.transport.getMockImplementation()!;
    f.transport.mockImplementation(async (url, init) => String(init.body).includes('"complete"') ? Response.json({ code: "FREE20_CONTEXT_REQUIRED" }, { status: 428 }) : original(url, init));
    const response = await f.request(); expect(response.status).toBe(428);
    expect(await response.json()).toMatchObject({ code: "FREE20_CONTEXT_UNAVAILABLE", retryable: true });
    expect(f.resource).toHaveLength(1);
  });
  it("single-flights simultaneous room and status enrollment", async () => {
    const f = fixture();
    const responses = await Promise.all([f.request(), f.request()]);
    expect(responses.map(r => r.status)).toEqual([200, 200]); expect(f.sign).toHaveBeenCalledTimes(1);
  });
  it("preserves context on refresh but retires it on same-owner new login and A/B switch", async () => {
    const f = fixture(); await f.request();
    f.current = { ...f.current!, accessToken: "refreshed", refreshToken: "rotated", authRevision: "r2" };
    f.client.onSessionChanged(f.current); await f.request(); expect(f.enrollment).toHaveLength(2);
    f.current = session(owner, "login-new"); f.client.onSessionChanged(f.current); await f.request(); expect(f.enrollment).toHaveLength(4);
    f.current = session("22222222-2222-4222-8222-222222222222", "login-b"); f.client.onSessionChanged(f.current);
    await f.request(); expect(f.enrollment).toHaveLength(6);
    expect(f.resource[5].has(FREE20_CONTEXT_HEADER)).toBe(false);
  });
  it("expires context at its absolute server deadline", async () => {
    vi.useFakeTimers(); const f = fixture(); await f.request(); await vi.advanceTimersByTimeAsync(1_800_000);
    await f.request(); expect(f.enrollment).toHaveLength(4);
  });
  it("drops delayed A enrollment after B login, without sending an A retry or caching for B", async () => {
    const f = fixture(); let resolve!: (value: typeof proof) => void;
    f.sign.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const a = f.request(); const rejected = expect(a).rejects.toThrow();
    await vi.waitFor(() => expect(f.sign).toHaveBeenCalled());
    f.current = session("22222222-2222-4222-8222-222222222222", "login-b"); f.client.onSessionChanged(f.current);
    resolve(proof); await rejected;
    await f.request(); expect(f.enrollment).toHaveLength(3);
    expect(f.resource).toHaveLength(3);
  });
  it("bounds hanging enrollment and discards a late completion after caller cancellation", async () => {
    vi.useFakeTimers(); const f = fixture(); f.sign.mockImplementationOnce(() => new Promise(() => {}));
    const request = f.request(); const rejected = expect(request).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(10_000); await rejected;
    expect(f.enrollment).toHaveLength(1);
    expect((await f.request()).status).toBe(200);
  });
  it("one cancelled waiter cannot cancel another's enrollment", async () => {
    const f = fixture(); let resolve!: (value: typeof proof) => void;
    f.sign.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const controller = new AbortController(); const a = f.request(controller.signal); const rejected = expect(a).rejects.toThrow();
    const b = f.request(); await vi.waitFor(() => expect(f.sign).toHaveBeenCalled());
    controller.abort(); await rejected; resolve(proof);
    expect((await b).status).toBe(200); expect(f.sign).toHaveBeenCalledTimes(1);
  });
  it("refreshes at most once and shares the same login context through 401", async () => {
    const f = fixture(); const original = f.transport.getMockImplementation()!;
    f.transport.mockImplementationOnce(async () => Response.json({}, { status: 401 }));
    f.refresh.mockImplementation(async () => f.current = { ...f.current!, accessToken: "fresh", refreshToken: "fresh-r", authRevision: "r2" });
    expect((await f.request()).status).toBe(200); expect(f.refresh).toHaveBeenCalledTimes(1);
    expect(f.resource[0].get("authorization")).toBe("Bearer fresh");
    expect(f.transport.getMockImplementation()).toBe(original);
  });
});

it("keeps the request deadline and owner fence through delayed resource body consumption", async () => {
  vi.useFakeTimers(); const f = fixture();
  f.transport.mockImplementation(async () => new Response(new ReadableStream({ start() {} })));
  const pending = f.request(); const rejected = expect(pending).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(10_000); await rejected;
});
it("all cancelled enrollment waiters discard late signer output and allow a fresh retry", async () => {
  const f = fixture(); let resolve!: (value: typeof proof) => void;
  f.sign.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const controller = new AbortController(); const pending = f.request(controller.signal); const rejected = expect(pending).rejects.toThrow();
  await vi.waitFor(() => expect(f.sign).toHaveBeenCalled()); controller.abort(); await rejected; resolve(proof);
  expect((await f.request()).status).toBe(200); expect(f.enrollment).toHaveLength(3);
});
it("late old-account resource body cannot publish after account replacement", async () => {
  const f = fixture(); let controller!: ReadableStreamDefaultController<Uint8Array>;
  f.transport.mockImplementationOnce(async () => new Response(new ReadableStream({ start(value) { controller = value; } })));
  const pending = f.request(); const rejected = expect(pending).rejects.toThrow();
  await vi.waitFor(() => expect(f.transport).toHaveBeenCalled());
  f.current = session(owner, "new-login"); f.client.onSessionChanged(f.current);
  controller.enqueue(new TextEncoder().encode("{}")); controller.close(); await rejected;
});
it("stale starting credentials and cross-origin destinations cannot make requests", async () => {
  const f = fixture();
  await expect(f.client.request(new URL("https://staging.anidachi.app/api/me/hosting-status"), { headers: { Authorization: "Bearer stale", [ACCOUNT_HOSTING_OWNER_HEADER]: owner } })).rejects.toThrow();
  await expect(f.client.request(new URL("https://other.example/api/me/hosting-status"), {})).rejects.toThrow();
  expect(f.transport).not.toHaveBeenCalled();
});
it.each(["challenge", "complete"])("continues %s after one credential refresh without restarting enrollment", async action => {
  const f = fixture(); const original = f.transport.getMockImplementation()!;
  let expired = false;
  f.transport.mockImplementation(async (url, init) => {
    if (!expired && String(init.body).includes(`"${action}"`)) { expired = true; return Response.json({}, { status: 401 }); }
    return original(url, init);
  });
  f.refresh.mockImplementation(async () => f.current = { ...f.current!, accessToken: "fresh", refreshToken: "fresh-r", authRevision: "r2" });
  expect((await f.request()).status).toBe(200);
  expect(f.refresh).toHaveBeenCalledTimes(1); expect(f.sign).toHaveBeenCalledTimes(1);
});
it("shares the one-refresh budget between enrollment and resource retry", async () => {
  const f = fixture(); const original = f.transport.getMockImplementation()!;
  let expired = false;
  f.transport.mockImplementation(async (url, init) => {
    if (!expired && String(init.body).includes('"challenge"')) { expired = true; return Response.json({}, { status: 401 }); }
    if (new Headers(init.headers).has("x-anidachi-free20-context")) return Response.json({}, { status: 401 });
    return original(url, init);
  });
  f.refresh.mockImplementation(async () => f.current = { ...f.current!, accessToken: "fresh", refreshToken: "fresh-r", authRevision: "r2" });
  expect((await f.request()).status).toBe(401); expect(f.refresh).toHaveBeenCalledTimes(1);
});
it("refuses a refresh result belonging to a new logical login", async () => {
  const f = fixture(); f.transport.mockImplementationOnce(async () => Response.json({}, { status: 401 }));
  f.refresh.mockImplementation(async () => f.current = session(owner, "new-login"));
  await expect(f.request()).rejects.toThrow(); expect(f.transport).toHaveBeenCalledTimes(1);
});
it.each([409, 503])("does not restart enrollment or mint a new identity on enrollment HTTP %s", async status => {
  const f = fixture(); const original = f.transport.getMockImplementation()!;
  f.transport.mockImplementation(async (url, init) => url.pathname.endsWith("free20-context") ? Response.json({ code: "unavailable" }, { status }) : original(url, init));
  expect((await f.request()).status).toBe(status); expect(f.sign).not.toHaveBeenCalled(); expect(f.transport).toHaveBeenCalledTimes(2);
});
it("reads a shared enrollment error body before retiring its network controller", async () => {
  const f = fixture(); const original = f.transport.getMockImplementation()!;
  f.transport.mockImplementation(async (url, init) => {
    if (!url.pathname.endsWith("free20-context")) return original(url, init);
    return new Response(new ReadableStream({ start(controller) {
      const abort = () => controller.error(new Error("Response body aborted"));
      init.signal!.addEventListener("abort", abort, { once: true });
      setTimeout(() => { init.signal!.removeEventListener("abort", abort); if (!init.signal!.aborted) { controller.enqueue(new TextEncoder().encode('{"code":"ROOM_AUTHORITY_UNAVAILABLE"}')); controller.close(); } }, 10);
    } }), { status: 503 });
  });
  const response = await f.request(); expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ code: "ROOM_AUTHORITY_UNAVAILABLE" });
});
