import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHostingAccess } from "../src/use-hosting-access";
import type { HostingAccountAccess } from "../src/hosting-access-client";

const owner = "11111111-1111-4111-8111-111111111111";
const legacy: HostingAccountAccess = {
  entitlementsVersion: 1, ownerUserId: owner, serverTime: "2026-09-28T00:00:00Z", planCode: "free",
  hosting: { hostingPolicyVersion: 1, hostingActivationAt: "2026-09-29T00:00:00Z", canHost: true, trialEligibility: "unavailable", trialEndsAt: null },
};
const active: HostingAccountAccess = { ...legacy, serverTime: "2026-09-29T00:00:00Z", hosting: { ...legacy.hosting!, hostingPolicyVersion: 2, canHost: false, trialEligibility: "eligible" } };
type Options = Parameters<typeof useHostingAccess>[0];
let options: Options, current: ReturnType<typeof useHostingAccess>, root: Root, host: HTMLDivElement;
function Harness() { current = useHostingAccess(options); return <output>{current.state.mode}</output>; }
async function render(patch: Partial<Options> = {}) { options = { ...options, ...patch }; await act(async () => root.render(<Harness />)); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }

describe("shared hosting display access", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    options = { ownerUserId: owner, sessionKey: "login-a", enabled: true, request: vi.fn().mockResolvedValue(legacy) };
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });
  it("uses server time for activation, never the device clock", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2099-01-01T00:00:00Z"));
    await render(); expect(current.state.mode).toBe("legacy");
    vi.mocked(options.request!).mockResolvedValue(active);
    await act(async () => current.refresh());
    expect(current.state.mode).toBe("paid-hosting");
    expect(current.state.access?.hosting?.canHost).toBe(false);
  });
  it("unknown or failed authority clears previous display claims without polling", async () => {
    await render();
    vi.mocked(options.request!).mockResolvedValue({ ...legacy, hosting: undefined });
    await act(async () => current.refresh()); expect(current.state.mode).toBe("unknown");
    vi.mocked(options.request!).mockRejectedValue(new Error("offline"));
    await act(async () => current.refresh());
    expect(current.state).toMatchObject({ mode: "unknown", error: true, busy: false });
    expect(current.state.access).toBeUndefined();
    vi.useFakeTimers(); await act(async () => vi.advanceTimersByTimeAsync(3_600_000));
    expect(options.request).toHaveBeenCalledTimes(3);
  });
  it("reads only when enabled and deduplicates focus/visibility while pending", async () => {
    const pending = deferred<HostingAccountAccess>();
    const request = vi.fn().mockReturnValue(pending.promise);
    await render({ enabled: false, request }); expect(request).not.toHaveBeenCalled();
    await render({ enabled: true });
    await act(async () => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(active)); expect(current.state.mode).toBe("paid-hosting");
  });
  it.each([{ ownerUserId: "22222222-2222-4222-8222-222222222222" }, { sessionKey: "login-b" }])("retires late answers across account/session changes (%j)", async patch => {
    const old = deferred<HostingAccountAccess>(), fresh = deferred<HostingAccountAccess>();
    const request = vi.fn().mockReturnValueOnce(old.promise).mockReturnValue(fresh.promise);
    await render({ request }); await render(patch);
    await act(async () => old.resolve(active));
    expect(current.state.mode).toBe("unknown"); expect(current.state.access).toBeUndefined();
    await act(async () => fresh.resolve({ ...legacy, ownerUserId: options.ownerUserId! }));
    expect(current.state.mode).toBe("legacy");
  });
  it("a newer server denial supersedes an in-flight legacy read", async () => {
    const old = deferred<HostingAccountAccess>(), fresh = deferred<HostingAccountAccess>();
    const request = vi.fn().mockReturnValueOnce(old.promise).mockReturnValue(fresh.promise);
    await render({ request });
    await act(async () => current.invalidate());
    expect(request).toHaveBeenCalledTimes(2);
    await act(async () => fresh.resolve(active));
    await act(async () => old.resolve(legacy));
    expect(current.state.mode).toBe("paid-hosting");
  });
  it("reopening never exposes the previous hosting grant while a fresh read is pending", async () => {
    await render(); expect(current.state.access?.hosting?.canHost).toBe(true);
    await render({ enabled: false });
    const pending = deferred<HostingAccountAccess>();
    vi.mocked(options.request!).mockReturnValue(pending.promise);
    await render({ enabled: true });
    expect(current.state.mode).toBe("unknown"); expect(current.state.access).toBeUndefined();
    await act(async () => pending.resolve(active)); expect(current.state.mode).toBe("paid-hosting");
  });
});
