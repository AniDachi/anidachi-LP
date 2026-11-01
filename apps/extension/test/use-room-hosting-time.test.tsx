import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRoomHostingTime } from "../src/use-room-hosting-time";
import { RoomHostingTime } from "../src/room-hosting-time";
import type { HostingTimeEvent } from "@anidachi/protocol";

const owner = "11111111-1111-4111-8111-111111111111", at = Date.parse("2026-11-01T12:00:00Z");
const event = (sequence: number, unknown = false): HostingTimeEvent => ({ type: "HOSTING_TIME", roomId: "room", roomGeneration: 1, serverTime: at, validUntil: at + 5_000, snapshot: { hostingTimeVersion: 1, ownerUserId: owner, roomId: "room", roomGeneration: 1, snapshotSequence: sequence, serverTime: at, period: { utcDay: "2026-11-01", resetAt: Date.parse("2026-11-02T00:00:00Z") }, access: unknown ? { kind: "unknown" } : { kind: "daily_free", budgetSeconds: 1200, usedSeconds: 1190, remainingSeconds: 10, metering: true } } });
let clock: RoomHostingTime, root: Root, host: HTMLElement, ready: boolean, send: ReturnType<typeof vi.fn<(event: import("@anidachi/protocol").ClientEvent) => unknown>>;
function Harness() { const time = useRoomHostingTime(clock, ready, send); return <output>{time?.remainingSeconds ?? "unknown"}</output>; }
const render = () => act(async () => root.render(<Harness />));
describe("live hosting time lifecycle recovery", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers(); vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    clock = new RoomHostingTime(); clock.bind({ ownerUserId: owner, roomId: "room", roomGeneration: 1 });
    send = vi.fn(); ready = true; host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });
  it("does not request old servers or poll persistent unknown events every five seconds", async () => {
    await render(); await act(async () => vi.advanceTimersByTimeAsync(10_000)); expect(send).not.toHaveBeenCalled();
    clock.accept(event(1, true)); await render(); await act(async () => vi.advanceTimersByTimeAsync(30_000)); expect(send).not.toHaveBeenCalled();
    await act(async () => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
    expect(send).toHaveBeenCalledTimes(1);
    clock.accept(event(2, true)); await act(async () => vi.advanceTimersByTimeAsync(30_000)); expect(send).toHaveBeenCalledTimes(1);
  });
  it("recovers an expired confirmed value once, and hides it during disconnect and resume", async () => {
    clock.accept(event(1)); await render(); expect(host.textContent).toBe("10");
    await act(async () => vi.advanceTimersByTimeAsync(5_000)); expect(host.textContent).toBe("unknown"); expect(send).toHaveBeenCalledTimes(1);
    clock.accept(event(2)); await act(async () => vi.advanceTimersByTimeAsync(30_000)); expect(send).toHaveBeenCalledTimes(1);
    clock.accept(event(3)); ready = false; await render(); expect(host.textContent).toBe("unknown"); ready = true; await render(); expect(host.textContent).toBe("unknown");
    await act(async () => window.dispatchEvent(new Event("focus"))); expect(send).toHaveBeenCalledTimes(2);
  });
});
