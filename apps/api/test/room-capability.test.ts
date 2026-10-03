import { describe, expect, it } from "vitest";
import { RoomMediaCapabilityLeaseSchema } from "@anidachi/protocol";
import { initialRoomPolicy, nextRoomPolicyAlarm } from "../src/room-capability";
import { createRoomMeterState, reconcileRoomMeter } from "../src/room-metering";

const start = Date.parse("2026-09-29T12:00:00Z");
function policy() {
  return { ...initialRoomPolicy("host", RoomMediaCapabilityLeaseSchema.parse({
    roomId: "room", roomGeneration: 1, issuedAt: new Date(start).toISOString(), paidUntil: null,
    capabilities: { mediaProtocolVersion: 3, hostPlanCode: "free", maxParticipants: 4,
      maxCameras: 4, maxMediaSeats: 4, capabilityRevision: 1,
      capabilitiesValidUntil: new Date(start + 1_800_000).toISOString() },
  }), start), refreshAt: start + 1_800_000,
    budget: { day: "2026-09-29", allowedSeconds: 1800 } };
}
describe("absolute policy deadlines", () => {
  it("keeps warning and exhaustion fixed across fractional seconds and checkpoints", () => {
    const p = policy();
    let meter = reconcileRoomMeter(createRoomMeterState(), true, start);
    for (const elapsed of [0, 499, 1500, 29_999]) {
      expect(nextRoomPolicyAlarm(p, start + elapsed, meter, true)).toBe(start + 1_500_000);
    }
    meter = reconcileRoomMeter(meter, false, start + 1500);
    meter = reconcileRoomMeter(meter, true, start + 1500);
    expect(nextRoomPolicyAlarm(p, start + 1999, meter, true)).toBe(start + 1_500_000);
    p.quotaWarnedDay = "2026-09-29";
    expect(nextRoomPolicyAlarm(p, start + 1999, meter, true)).toBe(start + 1_800_000);
  });
  it("preserves pause, lease, closing, UTC and already-due precedence", () => {
    const p = policy();
    const meter = reconcileRoomMeter(createRoomMeterState(), true, start);
    expect(nextRoomPolicyAlarm(p, start + 500, meter, false)).toBe(p.refreshAt);
    expect(nextRoomPolicyAlarm({ ...p, closingAt: start + 1000 }, start, meter, true)).toBe(start + 1000);
    expect(nextRoomPolicyAlarm({ ...p, refreshAt: start + 400 }, start, meter, true)).toBe(start + 400);
    expect(nextRoomPolicyAlarm(p, start + 1_500_100, meter, true)).toBe(start + 1_500_100);
    const late = Date.parse("2026-09-29T23:59:59Z");
    const latePolicy = structuredClone(p);
    latePolicy.refreshAt = late + 60000;
    latePolicy.lease.capabilities.capabilitiesValidUntil = new Date(late + 120000).toISOString();
    expect(nextRoomPolicyAlarm(latePolicy, late, reconcileRoomMeter(createRoomMeterState(), true, late), true)).toBe(late + 1000);
    expect(nextRoomPolicyAlarm({ ...p, budget: null }, start, meter, false)).toBe(start);
  });
});
