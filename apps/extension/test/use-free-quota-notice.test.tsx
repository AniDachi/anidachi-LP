import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomQuotaStatus } from "@anidachi/protocol";
import { useFreeQuotaNotice } from "../src/use-free-quota-notice";

const owner = "11111111-1111-4111-8111-111111111111";
const now = "2026-09-15T23:59:50Z";
function status(serverTime = now, remainingSeconds = 0): RoomQuotaStatus {
  return { schemaVersion: 1, ownerUserId: owner, serverTime, quota: { remainingSeconds, resetAt: "2026-09-16T00:00:00Z" } };
}
type Options = Parameters<typeof useFreeQuotaNotice>[0];
let root: Root;
let host: HTMLDivElement;
let current: ReturnType<typeof useFreeQuotaNotice>;
let options: Options;
function Harness() { current = useFreeQuotaNotice(options); return <output>{JSON.stringify(current.state)}</output>; }
async function render(patch: Partial<Options> = {}) { options = { ...options, ...patch }; await act(async () => root.render(<Harness />)); }
async function advance(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

describe("Free quota countdown", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers({ toFake: ["Date", "performance", "setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2040-01-01T00:00:00Z"));
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    options = { ownerUserId: owner, accessToken: "test-token", visible: true, isFree: true, exhaustion: null, request: vi.fn().mockResolvedValue(status()) };
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it("starts from server time even with an incorrect device date and counts elapsed time", async () => {
    await render(); expect(current.state).toMatchObject({ kind: "exhausted", remainingSeconds: 10 });
    await advance(3000); expect(current.state?.remainingSeconds).toBe(7);
    expect(options.request).toHaveBeenCalledTimes(1);
  });
  it.each(["2000-01-01T00:00:00Z", "2099-01-01T00:00:00Z"])("never grants time from a manual clock jump to %s", async date => {
    await render(); await advance(1000);
    vi.setSystemTime(new Date(date)); await advance(1000);
    expect(current.state?.kind).not.toBe("ready");
    await advance(3000);
    expect(options.request).toHaveBeenCalledTimes(2);
    expect(current.state).toMatchObject({ kind: "exhausted", remainingSeconds: 10 });
  });
  it("checks the server at zero and stays unavailable offline, without retry polling", async () => {
    const request = vi.fn().mockResolvedValueOnce(status()).mockRejectedValue(new Error("offline"));
    await render({ request }); await advance(10_000);
    expect(current.state?.kind).toBe("unavailable");
    await advance(60_000); expect(request).toHaveBeenCalledTimes(2);
    expect(current.state?.kind).not.toBe("ready");
  });
  it("confirms renewal at UTC midnight before showing availability", async () => {
    const request = vi.fn().mockResolvedValueOnce(status()).mockResolvedValue({ ...status("2026-09-16T00:00:00Z", 1800), quota: { remainingSeconds: 1800, resetAt: "2026-09-17T00:00:00Z" } });
    await render({ request }); await advance(10_000);
    expect(request).toHaveBeenCalledTimes(2); expect(current.state?.kind).toBe("ready");
  });
  it("counts request time instead of delaying the midnight check by response latency", async () => {
    let resolve!: (value: RoomQuotaStatus) => void;
    const request = vi.fn().mockImplementationOnce(() => new Promise<RoomQuotaStatus>(r => { resolve = r; }))
      .mockResolvedValue({ ...status("2026-09-16T00:00:00Z", 1800), quota: { remainingSeconds: 1800, resetAt: "2026-09-17T00:00:00Z" } });
    await render({ request }); await advance(5000);
    await act(async () => resolve(status()));
    expect(current.state).toMatchObject({ kind: "exhausted", remainingSeconds: 5 });
    await advance(5000);
    expect(request).toHaveBeenCalledTimes(2); expect(current.state?.kind).toBe("ready");
  });
  it("discards a response that was in flight while the device slept", async () => {
    let resolve!: (value: RoomQuotaStatus) => void;
    const request = vi.fn().mockImplementationOnce(() => new Promise<RoomQuotaStatus>(r => { resolve = r; }))
      .mockResolvedValue({ ...status("2026-09-16T06:00:00Z", 1800), quota: { remainingSeconds: 1800, resetAt: "2026-09-17T00:00:00Z" } });
    await render({ request, exhaustion: { ownerUserId: owner, resetAt: "2026-09-16T00:00:00Z" } });
    vi.setSystemTime(new Date("2040-01-02T00:00:00Z"));
    await act(async () => resolve(status()));
    expect(current.state?.kind).toBe("checking");
    await advance(5000);
    expect(request).toHaveBeenCalledTimes(2); expect(current.state?.kind).toBe("ready");
  });
  it("shows checking immediately when the response arrives beyond its reset", async () => {
    let resolve!: (value: RoomQuotaStatus) => void;
    const request = vi.fn().mockImplementationOnce(() => new Promise<RoomQuotaStatus>(r => { resolve = r; }))
      .mockResolvedValue({ ...status("2026-09-16T00:00:01Z", 1800), quota: { remainingSeconds: 1800, resetAt: "2026-09-17T00:00:00Z" } });
    await render({ request, exhaustion: { ownerUserId: owner, resetAt: "2026-09-16T00:00:00Z" } });
    await advance(11_000); await act(async () => resolve(status()));
    expect(current.state?.kind).toBe("checking");
    await advance(1000); expect(current.state?.kind).toBe("ready");
  });
  it("recognizes a paid upgrade immediately even before the Free reset", async () => {
    await render(); await advance(5000);
    vi.mocked(options.request!).mockResolvedValue({ ...status(), quota: null });
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(current.state?.kind).toBe("ready");
  });
  it("does not mistake delayed final accounting for a renewed day", async () => {
    await render({ request: vi.fn().mockResolvedValue(status(now, 60)), exhaustion: { ownerUserId: owner, resetAt: "2026-09-16T00:00:00Z" } });
    expect(current.state).toMatchObject({ kind: "exhausted", remainingSeconds: 10 });
  });
  it("rechecks after sleep without depending on performance ticking during sleep", async () => {
    await render(); await advance(5000);
    vi.mocked(options.request!).mockResolvedValue({ ...status("2026-09-16T06:00:00Z", 1800), quota: { remainingSeconds: 1800, resetAt: "2026-09-17T00:00:00Z" } });
    vi.setSystemTime(new Date("2040-01-02T00:00:00Z")); await advance(1000);
    expect(current.state?.kind).toBe("ready");
  });
  it("hides old account state and ignores its late response", async () => {
    let resolve!: (v: RoomQuotaStatus) => void;
    const request = vi.fn().mockImplementation(() => new Promise<RoomQuotaStatus>(r => { resolve = r; }));
    await render({ request });
    await render({ ownerUserId: null, accessToken: null });
    await act(async () => resolve(status())); expect(current.state).toBeNull();
  });
  it("does not contact the server while closed and checks fresh after reopening", async () => {
    await render({ visible: false }); expect(options.request).not.toHaveBeenCalled();
    await render({ visible: true }); expect(current.state?.remainingSeconds).toBe(10);
    await render({ visible: false }); await advance(30_000); expect(options.request).toHaveBeenCalledTimes(1);
    await render({ visible: true }); expect(options.request).toHaveBeenCalledTimes(2);
  });
  it("keeps a non-exhausted Free account quiet when the status request fails", async () => {
    await render({ request: vi.fn().mockRejectedValue(new Error("offline")) });
    expect(current.state).toBeNull();
  });
});
