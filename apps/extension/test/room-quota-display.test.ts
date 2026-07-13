import { describe, expect, it } from "vitest";
import {
  applyRoomUsageSnapshot,
  roomQuotaRemainingSeconds,
} from "../src/room-quota-display";

describe("room quota countdown", () => {
  it("subtracts authoritative room usage before local display time", () => {
    expect(
      roomQuotaRemainingSeconds({
        serverRemainingSeconds: 900,
        resetAt: "2026-07-13T00:00:00.000Z",
        roomUsage: { day: "2026-07-12", seconds: 125 },
        localMeteredMs: 2_500,
      }),
    ).toBe(772);
  });

  it("clamps malformed or exhausted values to zero", () => {
    expect(
      roomQuotaRemainingSeconds({
        serverRemainingSeconds: 30,
        resetAt: "2026-07-13T00:00:00.000Z",
        roomUsage: { day: "2026-07-12", seconds: 40 },
        localMeteredMs: -1,
      }),
    ).toBe(0);
  });

  it("does not subtract a previous UTC day's room usage from fresh quota", () => {
    expect(
      roomQuotaRemainingSeconds({
        serverRemainingSeconds: 1_800,
        resetAt: "2026-07-14T00:00:00.000Z",
        roomUsage: { day: "2026-07-12", seconds: 1_200 },
        localMeteredMs: 0,
      }),
    ).toBe(1_800);
  });

  it("keeps counting fresh local usage when the room anchor is from a previous day", () => {
    expect(
      roomQuotaRemainingSeconds({
        serverRemainingSeconds: 1_800,
        resetAt: "2026-07-14T00:00:00.000Z",
        roomUsage: { day: "2026-07-12", seconds: 1_200 },
        localMeteredMs: 300_000,
      }),
    ).toBe(1_500);
  });

  it("replaces authoritative usage and local elapsed as one anchor", () => {
    const current = {
      roomUsage: { day: "2026-07-12", seconds: 100 },
      localMeteredMs: 25_000,
    };
    const next = applyRoomUsageSnapshot(current, {
      day: "2026-07-12",
      seconds: 125,
    });

    expect(next).toEqual({
      roomUsage: { day: "2026-07-12", seconds: 125 },
      localMeteredMs: 0,
    });
    expect(applyRoomUsageSnapshot(next, undefined)).toBe(next);
    expect(
      applyRoomUsageSnapshot(next, {
        day: "2026-07-12",
        seconds: 120,
      }),
    ).toBe(next);
  });
});
