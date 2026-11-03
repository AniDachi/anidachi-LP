import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAccountHostingStatus } from "../src/use-account-hosting-status";
import type { AccountHostingStatus } from "@anidachi/protocol";

const owner = "11111111-1111-4111-8111-111111111111";
const at = Date.parse("2026-11-01T12:00:00Z");
const status = { accountHostingVersion: 1, ownerUserId: owner, planCode: "free", serverTime: at, validUntil: at + 60_000, period: { utcDay: "2026-11-01", resetAt: Date.parse("2026-11-02T00:00:00Z") }, access: { kind: "daily_free", budgetSeconds: 1200, usedSeconds: 420, remainingSeconds: 780, metering: false }, activeRoom: null, canCreateRoom: true } satisfies AccountHostingStatus;
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
  it("retains the fresh plan and retries an unsettled room close without restoring pre-room seconds", async () => {
    await render();
    await render({ roomId: "room-a" });
    vi.mocked(options.request!).mockRejectedValueOnce(new Error("HOSTING_STATUS_UNAVAILABLE"))
      .mockResolvedValue({ mode: "free20", status: { ...status, access: { ...status.access, remainingSeconds: 600, usedSeconds: 600 } } });
    await render({ roomId: null });
    expect(current.planCode).toBe("free");
    expect(current.remainingSeconds).toBeNull();
    expect(current.busy).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(current.remainingSeconds).toBe(600);
    expect(current.error).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(options.request).toHaveBeenCalledTimes(4);
  });
  it("bounds outage recovery and exposes failure instead of perpetual loading", async () => {
    vi.mocked(options.request!).mockRejectedValue(new Error("offline"));
    await render();
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(options.request).toHaveBeenCalledTimes(3);
    expect(current.busy).toBe(false);
    expect(current.error).toBe(true);
    expect(current.remainingSeconds).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(options.request).toHaveBeenCalledTimes(3);
  });
  it("reads immediately after a short visibility loss without the old five-second cooldown", async () => {
    await render();
    await act(async () => vi.advanceTimersByTimeAsync(100));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(options.request).toHaveBeenCalledTimes(2);
    expect(current.remainingSeconds).toBe(780);
  });
  it("keeps the original fresh display while a tab return revalidates slowly", async () => {
    await render();
    let reply!: (value: any) => void;
    vi.mocked(options.request!).mockImplementation(() => new Promise(resolve => { reply = resolve; }));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(current.remainingSeconds).toBe(780); expect(current.planCode).toBe("free");
    await act(async () => vi.advanceTimersByTimeAsync(6_000));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")); });
    expect(current.remainingSeconds).toBe(780); expect(current.planCode).toBe("free");
    expect(current.busy).toBe(true); expect(options.request).toHaveBeenCalledTimes(2);
    await act(async () => reply({ mode: "free20", status: { ...status, serverTime: at + 6_000, validUntil: at + 66_000, access: { ...status.access, usedSeconds: 450, remainingSeconds: 750 } } }));
    expect(current.remainingSeconds).toBe(750);
  });
  it.each(["plus", "pro"] as const)("keeps fresh %s metadata across credential rotation and fences older replies", async planCode => {
    const paid: AccountHostingStatus = { ...status, planCode, access: { kind: "confirmed_unlimited", source: "paid", validUntil: at + 3_600_000 } };
    vi.mocked(options.request!).mockResolvedValue({ mode: "free20", status: paid });
    await render({ credentialKey: "token-a" });
    const replies: ((value: any) => void)[] = [];
    vi.mocked(options.request!).mockImplementation(() => new Promise(resolve => replies.push(resolve)));
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); current.refresh(); });
    await render({ credentialKey: "token-b" });
    expect(options.request).toHaveBeenCalledTimes(3);
    expect(current.planCode).toBe(planCode); expect(current.remainingSeconds).toBeNull();
    await act(async () => replies[0]({ mode: "free20", status }));
    expect(current.planCode).toBe(planCode);
    await act(async () => replies[1]({ mode: "free20", status: { ...paid, serverTime: at + 5_000, validUntil: at + 65_000 } }));
    expect(current.planCode).toBe(planCode); expect(current.busy).toBe(false);
  });
  it.each(["expiry", "UTC reset"] as const)("retains idle Free time across rotation only until its original %s", async boundary => {
    const nearBoundary = boundary === "expiry" ? { ...status, validUntil: at + 5_000 } : {
      ...status, serverTime: status.period.resetAt - 5_000, validUntil: status.period.resetAt,
    };
    vi.mocked(options.request!).mockResolvedValue({ mode: "free20", status: nearBoundary });
    await render({ credentialKey: "token-a" });
    vi.mocked(options.request!).mockImplementation(() => new Promise(() => {}));
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    await render({ credentialKey: "token-b" });
    expect(current.remainingSeconds).toBe(780);
    expect(options.request).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(2_001));
    expect(current.remainingSeconds).toBeNull(); expect(current.planCode).toBeNull();
  });
  it.each(["plus", "pro"] as const)("retains only %s presentation through expiry and a failed refresh, then accepts a real downgrade", async planCode => {
    const paid: AccountHostingStatus = { ...status, planCode, access: { kind: "confirmed_unlimited", source: "paid", validUntil: at + 60_000 } };
    vi.mocked(options.request!).mockResolvedValue({ mode: "free20", status: paid });
    await render();
    vi.mocked(options.request!).mockRejectedValue(new Error("offline"));
    await act(async () => vi.advanceTimersByTimeAsync(65_000));
    expect(current.presentationPlanCode).toBe(planCode);
    expect(current.error).toBe(true);
    expect(current.status).toBeNull(); expect(current.planCode).toBeNull();
    expect(current.remainingSeconds).toBeNull(); expect(current.displayExpiresAt).toBeNull();
    vi.mocked(options.request!).mockResolvedValue({ mode: "free20", status: { ...status, serverTime: at + 65_000, validUntil: at + 125_000 } });
    await act(async () => current.refresh());
    expect(current.presentationPlanCode).toBe("free");
    expect(current.remainingSeconds).toBe(780);
  });
  it.each(["owner", "login", "denial", "legacy"] as const)("retires previous plan presentation on %s and rejects a late reply", async boundary => {
    const paid: AccountHostingStatus = { ...status, planCode: "pro", access: { kind: "confirmed_unlimited", source: "paid", validUntil: at + 3_600_000 } };
    vi.mocked(options.request!).mockResolvedValue({ mode: "free20", status: paid });
    await render();
    const replies: ((value: any) => void)[] = [];
    vi.mocked(options.request!).mockImplementation(() => new Promise(resolve => replies.push(resolve)));
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); current.refresh(); });
    expect(current.presentationPlanCode).toBe("pro");
    if (boundary === "owner") await render({ ownerUserId: "22222222-2222-4222-8222-222222222222" });
    if (boundary === "login") await render({ sessionKey: "another-login" });
    if (boundary === "denial") await act(async () => current.invalidate());
    if (boundary === "legacy") await act(async () => replies[0]({ mode: "legacy" }));
    expect(current.presentationPlanCode).toBeNull();
    await act(async () => replies[0]({ mode: "free20", status: paid }));
    expect(current.presentationPlanCode).toBeNull();
  });
  it("keeps manual unlimited presentation without retaining expired access or quota", async () => {
    vi.mocked(options.request!).mockResolvedValue({ mode: "free20", status: { ...status, planCode: "plus", access: { kind: "confirmed_unlimited", source: "manual", validUntil: at + 60_000 } } });
    await render();
    vi.mocked(options.request!).mockImplementation(() => new Promise(() => {}));
    await act(async () => vi.advanceTimersByTimeAsync(60_001));
    expect(current.presentationPlanCode).toBe("plus");
    expect(current.status).toBeNull(); expect(current.remainingSeconds).toBeNull();
  });
  it("keeps the room and login fences when credentials rotate during a pending room read", async () => {
    await render({ credentialKey: "token-a" });
    const replies: ((value: any) => void)[] = [];
    vi.mocked(options.request!).mockImplementation(() => new Promise(resolve => replies.push(resolve)));
    await render({ roomId: "room-a" });
    await render({ roomId: null, credentialKey: "token-b" });
    expect(current.remainingSeconds).toBeNull(); expect(current.planCode).toBe("free");
    await act(async () => replies[0]({ mode: "free20", status }));
    expect(current.remainingSeconds).toBeNull();
    await render({ sessionKey: "login-b" });
    expect(current.planCode).toBeNull(); expect(current.mode).toBe("unknown");
    await act(async () => replies[1]({ mode: "free20", status }));
    expect(current.planCode).toBeNull(); expect(current.remainingSeconds).toBeNull();
  });
  it("supersedes an early room-end read as soon as the end HTTP operation settles", async () => {
    await render(); await render({ roomId: "room-a" });
    let early!: (value: any) => void;
    vi.mocked(options.request!).mockImplementationOnce(() => new Promise(resolve => { early = resolve; }));
    await render({ roomId: null });
    vi.mocked(options.request!).mockResolvedValue({ mode: "free20", status: { ...status, access: { ...status.access, remainingSeconds: 600, usedSeconds: 600 } } });
    await render({ settlementRevision: 1 });
    expect(current.remainingSeconds).toBe(600);
    await act(async () => early({ mode: "free20", status }));
    expect(current.remainingSeconds).toBe(600);
  });
  it("does not mark an old failure complete for the post-settlement read", async () => {
    vi.mocked(options.request!).mockRejectedValue(new Error("settling"));
    await render({ roomId: "room-a" }); await render({ roomId: null });
    await act(async () => vi.advanceTimersByTimeAsync(2_100));
    expect(current.readComplete).toBe(true); expect(current.error).toBe(true);
    let resolve!: (value: any) => void;
    vi.mocked(options.request!).mockImplementation(() => new Promise(r => { resolve = r; }));
    await render({ settlementRevision: 1 });
    expect(current.readComplete).toBe(false);
    await act(async () => resolve({ mode: "free20", status }));
    expect(current.readComplete).toBe(true); expect(current.remainingSeconds).toBe(780);
  });
  it("never returns early digits as the result of a failed post-settlement read", async () => {
    await render(); await render({ roomId: "room-a" }); await render({ roomId: null });
    expect(current.remainingSeconds).toBe(780);
    vi.mocked(options.request!).mockRejectedValue(new Error("offline"));
    await render({ settlementRevision: 1 }); expect(current.remainingSeconds).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(2_100));
    expect(current.readComplete).toBe(true); expect(current.error).toBe(true);
    expect(current.remainingSeconds).toBeNull(); expect(current.planCode).toBe("free");
  });
  it("accepts a fresh active-room account observation after this tab was taken over", async () => {
    await render(); await render({ roomId: "room-a" });
    vi.mocked(options.request!).mockResolvedValueOnce({ mode: "free20", status: { ...status, activeRoom: { roomId: "room-a", role: "host" }, canCreateRoom: false } })
      .mockResolvedValue({ mode: "free20", status });
    await render({ roomId: null });
    expect(current.remainingSeconds).toBe(780);
    expect(current.status?.activeRoom?.roomId).toBe("room-a");
    expect(current.planCode).toBe("free");
  });
  it("does not repeat a long timeout and retires its fresh metadata at the original expiry", async () => {
    await render();
    vi.mocked(options.request!).mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10_000)));
    await render({ roomId: "room-a" });
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(current.planCode).toBe("free"); expect(current.error).toBe(true);
    expect(options.request).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(current.planCode).toBeNull(); expect(current.remainingSeconds).toBeNull();
  });
  it("cancels a queued recovery when the owner changes", async () => {
    vi.mocked(options.request!).mockRejectedValueOnce(new Error("offline"));
    await render();
    const otherOwner = "22222222-2222-4222-8222-222222222222";
    vi.mocked(options.request!).mockResolvedValue({ mode: "free20", status: { ...status, ownerUserId: otherOwner } });
    await render({ ownerUserId: otherOwner, sessionKey: "other-login" });
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(options.request).toHaveBeenCalledTimes(2);
    expect(current.status?.ownerUserId).toBe(otherOwner);
  });
  it("does not start a queued retry beyond its recovery window", async () => {
    vi.mocked(options.request!).mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error("slow failure")), 4_900)));
    await render();
    await act(async () => vi.advanceTimersByTimeAsync(5_500));
    expect(options.request).toHaveBeenCalledTimes(1);
    expect(current.error).toBe(true); expect(current.busy).toBe(false);
    expect(current.readComplete).toBe(true);
  });
  it("runs an explicit retry immediately after bounded recovery fails", async () => {
    vi.mocked(options.request!).mockRejectedValue(new Error("offline"));
    await render(); await act(async () => vi.advanceTimersByTimeAsync(2_100));
    expect(current.error).toBe(true);
    vi.mocked(options.request!).mockResolvedValue({ mode: "free20", status });
    await act(async () => current.refresh());
    expect(current.remainingSeconds).toBe(780); expect(current.error).toBe(false);
    expect(options.request).toHaveBeenCalledTimes(4);
  });
  it.each([true, false])("keeps a fresh plan but fences idle seconds across a room round trip (room read completed: %s)", async completed => {
    await render();
    const replies: ((value: any) => void)[] = [];
    vi.mocked(options.request!).mockImplementation(() => new Promise(resolve => replies.push(resolve)));
    await render({ roomId: "room-a" });
    expect(current.remainingSeconds).toBeNull();
    expect(current.planCode).toBe("free");
    const roomReply = replies.shift()!;
    if (completed) await act(async () => roomReply({ mode: "free20", status }));
    await render({ roomId: null });
    expect(current.remainingSeconds).toBeNull();
    expect(current.planCode).toBe("free");
    if (!completed) {
      await act(async () => roomReply({ mode: "free20", status }));
      expect(current.remainingSeconds).toBeNull();
    }
    await act(async () => replies.shift()!({ mode: "free20", status: { ...status, access: { ...status.access, remainingSeconds: 600, usedSeconds: 600 } } }));
    expect(current.remainingSeconds).toBe(600);
    await render({ sessionKey: "different-login" });
    expect(current.planCode).toBeNull();
    expect(current.remainingSeconds).toBeNull();
  });
  it("prefetches once, reuses fresh warm opens, and recovers once on opening after expiry", async () => {
    await render({ visible: false });
    await render({ visible: true }); await render({ visible: false });
    expect(options.request).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(180_000));
    expect(current.remainingSeconds).toBeNull(); expect(options.request).toHaveBeenCalledTimes(2);
    vi.mocked(options.request!).mockResolvedValue({ mode: "free20", status: { ...status, serverTime: at + 180_000, validUntil: at + 240_000 } });
    await render({ visible: true });
    expect(current.remainingSeconds).toBe(780); expect(options.request).toHaveBeenCalledTimes(3);
    await render({ visible: false }); await render({ visible: true });
    expect(options.request).toHaveBeenCalledTimes(3);
  });
  it("keeps explicit disabled policy through outages and panel reopening but never shares it with another login", async () => {
    vi.mocked(options.request!).mockResolvedValue({ mode: "legacy" }); await render(); expect(current.mode).toBe("legacy");
    vi.mocked(options.request!).mockRejectedValue(new Error("offline")); await render({ enabled: false }); await render({ enabled: true }); expect(current.mode).toBe("legacy");
    await render({ sessionKey: "login-b" }); expect(current.mode).toBe("unknown"); expect(current.remainingSeconds).toBeNull();
  });
  it("retires the displayed plan and an older pending read on authoritative admission denial", async () => {
    await render();
    let reply!: (value: any) => void;
    vi.mocked(options.request!).mockImplementationOnce(() => new Promise(resolve => { reply = resolve; }));
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); current.refresh(); });
    expect(current.planCode).toBe("free");
    await act(async () => current.invalidate());
    expect(current.planCode).toBeNull(); expect(current.remainingSeconds).toBeNull();
    await act(async () => reply({ mode: "free20", status }));
    expect(current.planCode).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(current.planCode).toBe("free");
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
    await act(async () => vi.advanceTimersByTimeAsync(120_000)); expect(options.request).toHaveBeenCalledTimes(5);
    expect(current.exhausted).toBe(true); expect(current.remainingSeconds).toBe(0); expect(current.resetSeconds).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(600_000)); expect(options.request).toHaveBeenCalledTimes(5);
  });
  it.each(["resume", "remount"])("does not re-anchor another pending read after %s", async lifecycle => {
    type Read = Awaited<ReturnType<NonNullable<Options["request"]>>>;
    let resolveOld!: (value: Read) => void, resolveNew!: (value: Read) => void;
    const oldRead = new Promise<Read>(resolve => { resolveOld = resolve; });
    const newRead = new Promise<Read>(resolve => { resolveNew = resolve; });
    let reads = 0;
    options.request = vi.fn((_owner, fresh) => reads++ === 0 || !fresh ? oldRead : newRead);
    await render();
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    if (lifecycle === "resume") {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    } else { await act(async () => root.unmount()); root = createRoot(host); }
    await act(async () => vi.advanceTimersByTimeAsync(4_000));
    if (lifecycle === "resume") {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
      await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    } else await render();
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    await act(async () => resolveOld({ mode: "free20", status: { ...status, validUntil: at + 5_000 } }));
    expect(current.remainingSeconds).toBeNull();
    await act(async () => resolveNew({ mode: "free20", status: { ...status, serverTime: at + 6_000, validUntil: at + 60_000 } }));
    expect(current.remainingSeconds).toBe(780);
    expect(options.request).toHaveBeenCalledTimes(2);
  });
  it("retires a reading on a real sleep clock discontinuity and requests fresh data", async () => {
    await render(); vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    vi.setSystemTime(Date.now() + 60_000); // wall advances while monotonic clock is paused
    vi.mocked(options.request!).mockImplementation(() => new Promise(() => {}));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible"); await act(async () => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")); });
    expect(options.request).toHaveBeenCalledTimes(2); expect(current.remainingSeconds).toBeNull(); expect(current.planCode).toBeNull();
  });
  it.each(["expiry", "UTC reset"])("does not revive the old account display after hidden %s", async boundary => {
    const nearBoundary = boundary === "expiry" ? { ...status, validUntil: at + 5_000 } : {
      ...status, serverTime: status.period.resetAt - 5_000, validUntil: status.period.resetAt,
    };
    vi.mocked(options.request!).mockResolvedValue({ mode: "free20", status: nearBoundary });
    await render(); expect(current.remainingSeconds).toBe(780);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => vi.advanceTimersByTimeAsync(6_000));
    vi.mocked(options.request!).mockImplementation(() => new Promise(() => {}));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(current.remainingSeconds).toBeNull(); expect(current.planCode).toBeNull();
  });
  it("does not refresh the observation age when a visible tab's timers were throttled", async () => {
    await render();
    const monotonic = performance.now(), wall = Date.now();
    vi.spyOn(performance, "now").mockReturnValue(monotonic + 10_000);
    vi.spyOn(Date, "now").mockReturnValue(wall + 10_000);
    vi.mocked(options.request!).mockImplementation(() => new Promise(() => {}));
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(current.remainingSeconds).toBe(780); expect(current.planCode).toBe("free");
    expect(options.request).toHaveBeenCalledTimes(2);
    vi.mocked(performance.now).mockReturnValue(monotonic + 60_000);
    vi.mocked(Date.now).mockReturnValue(wall + 60_000);
    await render(); expect(current.remainingSeconds).toBeNull();
  });
  it("replaces an expiry read invalidated by a subsequent clock discontinuity", async () => {
    await render();
    const replies: ((value: any) => void)[] = [];
    vi.mocked(options.request!).mockImplementation(() => new Promise(resolve => replies.push(resolve)));
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(options.request).toHaveBeenCalledTimes(2);
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(options.request).toHaveBeenCalledTimes(3); expect(current.busy).toBe(true);
    await act(async () => replies[0]({ mode: "free20", status }));
    expect(current.remainingSeconds).toBeNull();
    await act(async () => replies[1]({ mode: "free20", status: { ...status, serverTime: at + 121_000, validUntil: at + 181_000 } }));
    expect(current.remainingSeconds).toBe(780);
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(options.request).toHaveBeenCalledTimes(3);
  });
});
