import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAccountHostingStatus } from "../src/use-account-hosting-status";
import type { AccountHostingStatus } from "@anidachi/protocol";

const owner = "11111111-1111-4111-8111-111111111111";
const at = Date.parse("2026-11-01T12:00:00Z");
const status: AccountHostingStatus = { accountHostingVersion: 1, ownerUserId: owner, planCode: "free", serverTime: at, validUntil: at + 60_000, period: { utcDay: "2026-11-01", resetAt: Date.parse("2026-11-02T00:00:00Z") }, access: { kind: "daily_free", budgetSeconds: 1200, usedSeconds: 420, remainingSeconds: 780, metering: false }, activeRoom: null, canCreateRoom: true };
type Options = Parameters<typeof useAccountHostingStatus>[0];
let options: Options, current: ReturnType<typeof useAccountHostingStatus>, root: Root, host: HTMLElement;
function Harness() { current = useAccountHostingStatus(options); return <output>{current.remainingSeconds}</output>; }
async function render(patch: Partial<Options> = {}) { options = { ...options, ...patch }; await act(async () => root.render(<Harness />)); }
describe("account Free20 display", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers(); vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    options = { ownerUserId: owner, sessionKey: "login-a", enabled: true, exhaustion: null, request: vi.fn().mockResolvedValue({ mode: "free20", status }) };
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });
  it("keeps idle time fixed and does only one bounded expiry recheck, not a polling loop", async () => {
    await render(); expect(current.remainingSeconds).toBe(780);
    await act(async () => vi.advanceTimersByTimeAsync(30_000)); expect(current.remainingSeconds).toBe(780); expect(options.request).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(180_000)); expect(options.request).toHaveBeenCalledTimes(2); expect(current.remainingSeconds).toBeNull();
  });
  it("keeps explicit disabled policy through outages and panel reopening but never shares it with another login", async () => {
    vi.mocked(options.request!).mockResolvedValue({ mode: "legacy" }); await render(); expect(current.mode).toBe("legacy");
    vi.mocked(options.request!).mockRejectedValue(new Error("offline")); await render({ enabled: false }); await render({ enabled: true }); expect(current.mode).toBe("legacy");
    await render({ sessionKey: "login-b" }); expect(current.mode).toBe("unknown"); expect(current.remainingSeconds).toBeNull();
  });
  it("never treats failures as disabled policy or returns a late old session answer", async () => {
    let resolve!: (value: Awaited<ReturnType<NonNullable<Options["request"]>>>) => void;
    vi.mocked(options.request!).mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockRejectedValue(new Error("unknown"));
    await render(); await render({ sessionKey: "login-b" }); await act(async () => resolve({ mode: "free20", status }));
    expect(current.mode).toBe("unknown"); expect(current.remainingSeconds).toBeNull(); expect(current.exhausted).toBe(false);
  });
  it("latches server exhaustion through unsettled positive reads, until the next server UTC day or unlimited grant", async () => {
    await render({ exhaustion: { ownerUserId: owner, resetAt: new Date(status.period.resetAt).toISOString() } });
    expect(current.exhausted).toBe(true); expect(current.remainingSeconds).toBe(0);
    const tomorrow = { ...status, serverTime: status.period.resetAt, validUntil: status.period.resetAt + 60_000, period: { utcDay: "2026-11-02", resetAt: status.period.resetAt + 86_400_000 } };
    vi.mocked(options.request!).mockResolvedValue({ mode: "free20", status: tomorrow }); await act(async () => { await vi.advanceTimersByTimeAsync(5_000); current.refresh(); });
    expect(current.exhausted).toBe(false); expect(current.remainingSeconds).toBe(780);
    await render({ enabled: false }); await render({ enabled: true }); expect(current.exhausted).toBe(false);
  });
  it("does not inherit a previous login's exhaustion or cached mode", async () => {
    await render({ exhaustion: { ownerUserId: owner, resetAt: new Date(status.period.resetAt).toISOString(), sessionKey: "login-a", free20: true } });
    expect(current.exhausted).toBe(true);
    vi.mocked(options.request!).mockRejectedValue(new Error("offline"));
    await render({ sessionKey: "login-b" }); expect(current.exhausted).toBe(false); expect(current.remainingSeconds).toBeNull(); expect(current.mode).toBe("unknown");
  });
  it("does one UTC reset read after expiry recovery and never grants a new local budget", async () => {
    const nearReset = { ...status, serverTime: status.period.resetAt - 180_000, validUntil: status.period.resetAt - 120_000, access: { ...status.access, kind: "daily_free" as const, budgetSeconds: 1200 as const, usedSeconds: 1200, remainingSeconds: 0, metering: false }, canCreateRoom: false };
    vi.mocked(options.request!).mockResolvedValue({ mode: "free20", status: nearReset });
    await render(); expect(current.exhausted).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(121_000)); expect(options.request).toHaveBeenCalledTimes(2);
    vi.mocked(options.request!).mockRejectedValue(new Error("unavailable after reset"));
    await act(async () => vi.advanceTimersByTimeAsync(120_000)); expect(options.request).toHaveBeenCalledTimes(3);
    expect(current.exhausted).toBe(true); expect(current.remainingSeconds).toBe(0); expect(current.resetSeconds).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(600_000)); expect(options.request).toHaveBeenCalledTimes(3);
  });
  it("hides a reading on sleep/visibility loss and requests one recovery on resume", async () => {
    await render(); vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => document.dispatchEvent(new Event("visibilitychange"))); expect(current.remainingSeconds).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(6_000));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible"); await act(async () => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")); });
    expect(options.request).toHaveBeenCalledTimes(2); expect(current.remainingSeconds).toBe(780);
  });
});
