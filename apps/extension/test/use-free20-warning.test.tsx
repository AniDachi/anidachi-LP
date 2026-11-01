import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFree20Warning, type Free20WarningInput } from "../src/use-free20-warning";
import type { Free20WarningResult } from "../src/free20-warning-client";
import type { HostingTimeDisplay } from "../src/room-hosting-time";

const owner = "11111111-1111-4111-8111-111111111111", at = Date.parse("2026-11-01T12:00:00Z");
const login = JSON.stringify([owner, "login", "login-a"]);
function time(remaining = 299, sequence = 1, day = "2026-11-01"): HostingTimeDisplay {
  return { remainingSeconds: remaining, resetSeconds: 43200, snapshot: { hostingTimeVersion: 1, ownerUserId: owner, roomId: "room", roomGeneration: 1, snapshotSequence: sequence, serverTime: at, period: { utcDay: day, resetAt: at + 43200000 }, access: { kind: "daily_free", budgetSeconds: 1200, usedSeconds: 1200 - remaining, remainingSeconds: remaining, metering: true } } };
}
const response = (decision: "show" | "not_eligible" | "already_claimed" = "show"): Free20WarningResult => ({ kind: "server", response: { hostingWarningVersion: 1, ownerUserId: owner, roomId: "room", roomGeneration: 1, utcDay: "2026-11-01", serverTime: at, validUntil: at + 10000, decision, ...(decision === "show" ? { thresholdSeconds: 300 as const, claimId: crypto.randomUUID() } : {}) } } as Free20WarningResult);
let host: HTMLElement, root: Root, input: Free20WarningInput, current: HostingTimeDisplay | null, dismiss: () => void;
let request: ReturnType<typeof vi.fn<NonNullable<Free20WarningInput["request"]>>>;
function Harness() { const warning = useFree20Warning(input); dismiss = warning.dismiss; return <output>{warning.visible ? "notice" : "hidden"}</output>; }
const render = () => act(async () => root.render(<Harness />));
const tick = async (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
describe("Free20 warning lifecycle", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "performance"] }); vi.setSystemTime(at);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    current = time(); request = vi.fn().mockResolvedValue(response());
    input = { ownerUserId: owner, sessionKey: login, credentialRevision: "revision-a", isHost: true, connected: true, roomId: "room", roomGeneration: 1, sourceGeneration: 1, connectionGeneration: 1, reading: current, readFresh: () => current, request };
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });
  it("shows on the first below300 observation and never sends on ordinary ticks or focus", async () => {
    await render(); expect(host.textContent).toBe("notice"); expect(request).toHaveBeenCalledTimes(1);
    for (let remaining = 298; remaining > 280; remaining--) { current = time(remaining); input.reading = current; await render(); }
    await tick(20000); await act(async () => window.dispatchEvent(new Event("focus")));
    expect(request).toHaveBeenCalledTimes(1); expect(host.textContent).toBe("notice");
    await act(async () => dismiss()); await render(); expect(host.textContent).toBe("hidden"); expect(request).toHaveBeenCalledTimes(1);
  });
  it("retries transient failure once after five seconds and does not loop", async () => {
    request.mockResolvedValue({ kind: "failed", retryable: true }); await render();
    await tick(4999); expect(request).toHaveBeenCalledTimes(1);
    await tick(1); expect(request).toHaveBeenCalledTimes(2);
    await tick(60000); await render(); expect(request).toHaveBeenCalledTimes(2);
  });
  it("waits for a newer authoritative below300 snapshot after an early local crossing", async () => {
    current = time(301); current.remainingSeconds = 300; input.reading = current;
    request.mockResolvedValueOnce(response("not_eligible")); await render();
    await tick(5000); current.remainingSeconds = 295; await render(); expect(request).toHaveBeenCalledTimes(1);
    current = time(299, 2); input.reading = current; await render(); expect(request).toHaveBeenCalledTimes(2); expect(host.textContent).toBe("notice");
  });
  it.each(["room", "generation"])("allows the remaining crossing attempt at a lower sequence in a new %s", async change => {
    current = time(301, 50); current.remainingSeconds = 300; input.reading = current;
    request.mockResolvedValueOnce(response("not_eligible")); await render(); await tick(5000);
    current = time(299, 50); input.reading = current; await render();
    current = time(299, 49); input.reading = current; await render(); expect(request).toHaveBeenCalledTimes(1);
    if (change === "room") input.roomId = "room-b"; else input.roomGeneration = 2;
    current = { ...time(299, 1), snapshot: { ...time(299, 1).snapshot, roomId: input.roomId!, roomGeneration: input.roomGeneration } };
    input.reading = current;
    const result = response() as Extract<Free20WarningResult, { kind: "server" }>;
    request.mockResolvedValueOnce({ ...result, response: { ...result.response, roomId: input.roomId!, roomGeneration: input.roomGeneration } });
    await render(); expect(request).toHaveBeenCalledTimes(2); expect(host.textContent).toBe("notice");
    await act(async () => dismiss()); current = { ...current, snapshot: { ...current.snapshot, snapshotSequence: 2 } }; input.reading = current;
    await tick(5000); await render(); expect(request).toHaveBeenCalledTimes(2); expect(host.textContent).toBe("hidden");
  });
  it.each(["zero", "unknown", "paid", "guest", "disconnected", "hidden", "owner"])("does not claim or show for %s", async state => {
    if (state === "zero") current = time(0);
    if (state === "unknown") current = null;
    if (state === "paid") current = { ...time(), remainingSeconds: null, snapshot: { ...time().snapshot, access: { kind: "confirmed_unlimited", source: "paid", validUntil: at + 60000 } } };
    if (state === "guest") input.isHost = false;
    if (state === "disconnected") input.connected = false;
    if (state === "owner") input.ownerUserId = "22222222-2222-4222-8222-222222222222";
    if (state === "hidden") vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    input.reading = current; await render(); expect(request).not.toHaveBeenCalled(); expect(host.textContent).toBe("hidden");
  });
  it.each(["hidden", "zero", "unknown", "paid", "disconnect", "room-end"])("hides a consumed notice on %s without resurrection", async state => {
    await render(); expect(host.textContent).toBe("notice");
    if (state === "hidden") { vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden"); await act(async () => document.dispatchEvent(new Event("visibilitychange"))); }
    if (state === "zero") current = time(0);
    if (state === "unknown") current = null;
    if (state === "paid") current = { ...time(), remainingSeconds: null };
    if (state === "disconnect") input.connected = false;
    if (state === "room-end") input.roomId = null;
    input.reading = current; await render(); expect(host.textContent).toBe("hidden");
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible"); current = time(); input.reading = current; input.connected = true; input.roomId = "room";
    await render(); expect(host.textContent).toBe("hidden"); expect(request).toHaveBeenCalledTimes(1);
  });
  it.each(["credentials", "login", "room", "generation", "source", "connection", "day", "sleep"])("aborts/fences pending completion after %s", async change => {
    let resolve!: (value: Free20WarningResult) => void;
    request.mockResolvedValue({ kind: "suppressed" });
    request.mockImplementationOnce(() => new Promise(done => { resolve = done; })); await render();
    const signal = request.mock.calls[0][1];
    if (change === "credentials") input.credentialRevision = "revision-b";
    if (change === "login") input.sessionKey = JSON.stringify([owner, "login", "login-b"]);
    if (change === "room") input.roomId = "other";
    if (change === "generation") input.roomGeneration = 2;
    if (change === "source") input.sourceGeneration = 2;
    if (change === "connection") input.connectionGeneration = 2;
    if (change === "day") current = time(299, 2, "2026-11-02");
    if (change === "sleep") { current = null; await tick(6000); }
    input.reading = current; await render();
    await act(async () => resolve(response())); expect(host.textContent).toBe("hidden"); expect(signal.aborted).toBe(true);
  });
  it("preserves retry budget through credential refresh but uses a new logical login/day budget", async () => {
    request.mockResolvedValue({ kind: "failed", retryable: true }); await render();
    input.credentialRevision = "revision-b"; await render(); await tick(5000); expect(request).toHaveBeenCalledTimes(2);
    input.credentialRevision = "revision-c"; await render(); await tick(10000); expect(request).toHaveBeenCalledTimes(2);
    input.sessionKey = JSON.stringify([owner, "login", "login-b"]); await render(); expect(request).toHaveBeenCalledTimes(3);
    current = time(299, 2, "2026-11-02"); input.reading = current; await render(); expect(request).toHaveBeenCalledTimes(4);
  });
  it("rejects expired, wrong-scope and stale-clock show replies", async () => {
    request.mockImplementationOnce(async () => { current = null; return response(); }); await render(); expect(host.textContent).toBe("hidden");
    input.sessionKey = JSON.stringify([owner, "login", "login-c"]); current = time(); input.reading = current;
    request.mockResolvedValueOnce({ ...response(), response: { ...(response() as Extract<Free20WarningResult, { kind: "server" }>).response, roomId: "other" } } as Free20WarningResult);
    await render(); expect(host.textContent).toBe("hidden");
    input.sessionKey = JSON.stringify([owner, "login", "login-d"]);
    request.mockImplementationOnce(async () => { await vi.advanceTimersByTimeAsync(11000); return response(); }); await render(); expect(host.textContent).toBe("hidden");
  });
  it("does not put a legacy credential-derived session key into warning messages", async () => {
    input.sessionKey = JSON.stringify([owner, "credentials", "revision-a", "secret-access", "secret-refresh"]);
    await render(); expect(request).not.toHaveBeenCalled();
  });
});
