import { describe, expect, it } from "vitest";
import {
  createRoomMeterState,
  parseRoomMeterState,
  reconcileRoomMeter,
  roomUsageSummary,
} from "../src/room-metering";

describe("room quota meter", () => {
  it("does not charge a solo host", () => {
    const state = reconcileRoomMeter(createRoomMeterState(), false, 1_000);

    expect(roomUsageSummary(state, 61_000)).toEqual({
      day: "1970-01-01",
      seconds: 0,
    });
  });

  it("charges only intervals with a live host and guest", () => {
    let state = reconcileRoomMeter(createRoomMeterState(), true, 1_000);
    state = reconcileRoomMeter(state, false, 11_500);
    state = reconcileRoomMeter(state, true, 21_000);

    expect(roomUsageSummary(state, 26_700)).toEqual({
      day: "1970-01-01",
      seconds: 16,
    });
  });

  it("keeps one active interval across a same-room reconnect", () => {
    let state = reconcileRoomMeter(createRoomMeterState(), true, 10_000);
    state = reconcileRoomMeter(state, true, 15_000);

    expect(state.activeSince).toBe(10_000);
    expect(roomUsageSummary(state, 20_000).seconds).toBe(10);
  });

  it("never creates negative usage under clock skew", () => {
    const state = reconcileRoomMeter(createRoomMeterState(), true, 10_000);

    expect(roomUsageSummary(state, 9_000).seconds).toBe(0);
    expect(reconcileRoomMeter(state, false, 9_000).accumulatedMs).toBe(0);
  });

  it("parses only bounded durable meter state", () => {
    const state = reconcileRoomMeter(createRoomMeterState(), true, 10_000);

    expect(parseRoomMeterState(state)).toEqual(state);
    expect(parseRoomMeterState({ ...state, accumulatedMs: -1 })).toBeNull();
    expect(parseRoomMeterState({ ...state, day: "10-07-2026" })).toBeNull();
    expect(
      parseRoomMeterState({ ...state, activeSince: Number.MAX_VALUE }),
    ).toBeNull();
  });
});
