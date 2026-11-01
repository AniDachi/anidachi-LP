import { describe, expect, it } from "vitest";
import { RoomHostingTime } from "../src/room-hosting-time";
import type { HostingTimeEvent } from "@anidachi/protocol";

const owner = "11111111-1111-4111-8111-111111111111";
const at = Date.parse("2026-11-01T12:00:00Z");
const event = (sequence = 1, metering = true): HostingTimeEvent => ({ type: "HOSTING_TIME", roomId: "room", roomGeneration: 1, serverTime: at, validUntil: at + 60_000, snapshot: { hostingTimeVersion: 1, ownerUserId: owner, roomId: "room", roomGeneration: 1, snapshotSequence: sequence, serverTime: at, period: { utcDay: "2026-11-01", resetAt: Date.parse("2026-11-02T00:00:00Z") }, access: { kind: "daily_free", budgetSeconds: 1200, usedSeconds: 1190, remainingSeconds: 10, metering } } });
function bound() { const clock = new RoomHostingTime(); clock.bind({ ownerUserId: owner, roomId: "room", roomGeneration: 1 }); return clock; }
describe("authoritative room hosting time", () => {
  it("uses monotonic elapsed time only while metering, including paused playback, clamped to zero", () => {
    const clock = bound(); expect(clock.accept(event(), 100)).toBe(true);
    expect(clock.read(5_100)?.remainingSeconds).toBe(5); expect(clock.read(12_100)?.remainingSeconds).toBe(0);
    clock.accept(event(2, false), 13_100); expect(clock.read(40_100)?.remainingSeconds).toBe(10);
  });
  it("does not bind owner, room, generation or UTC day from the incoming nested value", () => {
    const clock = bound(); const wrong = event(); wrong.snapshot.ownerUserId = "22222222-2222-4222-8222-222222222222";
    expect(clock.accept(wrong, 0)).toBe(false); expect(clock.observed).toBe(false);
    wrong.snapshot.ownerUserId = owner; wrong.snapshot.period.utcDay = "2026-11-02"; expect(clock.accept(wrong, 0)).toBe(false);
  });
  it("retains ordering on reconnect, retires unknown and expiration without resurrecting old time", () => {
    const clock = bound(); clock.accept(event(5), 0); clock.beginTransport();
    expect(clock.accept(event(6), 100)).toBe(false); expect(clock.requestRecovery(100)).toBeNull();
    clock.bind({ ownerUserId: owner, roomId: "room", roomGeneration: 1 });
    expect(clock.read(100)).toBeNull(); expect(clock.accept(event(4), 100)).toBe(false);
    const unknown = event(6); unknown.snapshot.access = { kind: "unknown" }; expect(clock.accept(unknown, 200)).toBe(true);
    expect(clock.observed).toBe(true); expect(clock.read(200)?.remainingSeconds).toBeNull(); expect(clock.read(60_200)).toBeNull();
    expect(clock.accept(event(5), 60_200)).toBe(false);
  });
  it("never grants a budget at UTC reset or requests old servers", () => {
    const clock = bound(); expect(clock.requestRecovery(0)).toBeNull();
    const nearMidnight = event(); nearMidnight.serverTime = nearMidnight.snapshot.serverTime = nearMidnight.snapshot.period.resetAt - 1_000; nearMidnight.validUntil = nearMidnight.snapshot.period.resetAt;
    clock.accept(nearMidnight, 0); expect(clock.read(1_000)).toBeNull();
    expect(clock.requestRecovery(1_000)).toMatchObject({ type: "HOSTING_TIME_REQUEST", roomId: "room", requestId: expect.any(String) });
    expect(clock.requestRecovery(2_000)).toBeNull(); expect(clock.requestRecovery(6_000)).not.toBeNull();
    clock.clear(); expect(clock.observed).toBe(false); expect(clock.requestRecovery(10_000)).toBeNull();
  });
  it("charges delivery lag from JOIN start and the retained server/monotonic anchor", () => {
    const clock = new RoomHostingTime(); clock.beginTransport(0); clock.bind({ ownerUserId: owner, roomId: "room", roomGeneration: 1 });
    expect(clock.accept(event(1), 4_000)).toBe(true); expect(clock.read(4_000)?.remainingSeconds).toBe(6);
    expect(clock.accept(event(2), 9_000)).toBe(true); expect(clock.read(9_000)?.remainingSeconds).toBe(1);
    expect(clock.accept(event(3), 60_001)).toBe(true); expect(clock.read(60_001)).toBeNull();
  });
  it("rejects buffered messages across suspension until a correlated recovery completes", () => {
    const clock = bound(); clock.accept(event(1), 0); clock.checkContinuity(0, at);
    clock.checkContinuity(10, at + 60_000); // performance paused during device sleep
    expect(clock.read(10)).toBeNull(); expect(clock.accept(event(2), 10)).toBe(false);
    const request = clock.requestRecovery(10)!;
    expect(clock.accept({ ...event(3), requestId: "11111111-1111-4111-8111-111111111111" }, 20)).toBe(false);
    expect(clock.accept({ ...event(4), requestId: request.requestId }, 2_010)).toBe(true);
    expect(clock.read(2_010)?.remainingSeconds).toBe(8);
    clock.suspend(); expect(clock.accept({ ...event(5), requestId: request.requestId }, 2_020)).toBe(false);
  });
  it("can recover when the first negotiated event arrived while hidden", () => {
    const clock = bound(); clock.suspend(); expect(clock.accept(event(), 0)).toBe(false);
    expect(clock.observed).toBe(true); expect(clock.read(0)).toBeNull();
    const request = clock.requestRecovery(1_000)!; expect(request).not.toBeNull();
    expect(clock.accept({ ...event(2), requestId: request.requestId }, 1_100)).toBe(true);
  });
});

it('requires scoped explicit legacy mode and never downgrades a daily room',()=>{
  const legacy={type:'HOSTING_TIME_LEGACY',roomId:'room',roomGeneration:1};
  const clock=bound();
  expect(clock.acceptLegacy({...legacy,roomId:'other'})).toBe(false);
  expect(clock.acceptLegacy({...legacy,roomGeneration:2})).toBe(false);
  expect(clock.legacy).toBe(false);
  expect(clock.acceptLegacy(legacy)).toBe(true); expect(clock.legacy).toBe(true);
  expect(clock.accept(event(),0)).toBe(false);
  clock.beginTransport(); expect(clock.acceptLegacy(legacy)).toBe(false);
  clock.bind({ownerUserId:owner,roomId:'room',roomGeneration:1}); expect(clock.acceptLegacy(legacy)).toBe(true);
  clock.clear(); clock.bind({ownerUserId:owner,roomId:'room',roomGeneration:2});
  expect(clock.legacy).toBe(false); expect(clock.acceptLegacy(legacy)).toBe(false);
  const daily=bound(); daily.accept(event(),0); expect(daily.acceptLegacy(legacy)).toBe(false); expect(daily.legacy).toBe(false);
});
