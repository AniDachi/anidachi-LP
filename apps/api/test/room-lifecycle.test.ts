import { describe, expect, it } from "vitest";
import {
  EMPTY_ROOM_TIMEOUT_MS,
  createEmptyRoomEndEventId,
} from "@anidachi/protocol";
import * as roomLifecycle from "../src/room-lifecycle";

const lifecycleApi = roomLifecycle as typeof roomLifecycle & {
  emptyRoomRetryAt?: (attempts: number, now: number) => number;
  parseRoomLifecycleState?: (value: unknown) => Record<string, unknown> | null;
};
describe("room lifecycle state", () => {
  it("parses every durable state and rejects malformed outbox data", async () => {
    expect(typeof lifecycleApi.parseRoomLifecycleState).toBe("function");
    if (!lifecycleApi.parseRoomLifecycleState) return;

    const emptySince = 2;
    const endedAt = emptySince + EMPTY_ROOM_TIMEOUT_MS;
    const eventId = await createEmptyRoomEndEventId("room-1", emptySince);
    expect(eventId).toMatch(/^empty_timeout:[a-f0-9]{64}$/);
    const states = [
      { schemaVersion: 1, status: "active", updatedAt: 1 },
      { schemaVersion: 1, status: "empty", emptySince, alarmAt: endedAt },
      {
        schemaVersion: 1,
        status: "ending",
        emptySince,
        endedAt,
        eventId,
        attempts: 1,
        nextAttemptAt: endedAt + 1,
      },
      { schemaVersion: 1, status: "ended", endedAt, reason: "empty_timeout" },
    ];
    for (const state of states) {
      expect(lifecycleApi.parseRoomLifecycleState(state)).toEqual(state);
    }
    expect(lifecycleApi.parseRoomLifecycleState({
      schemaVersion: 1,
      status: "ending",
      emptySince,
      endedAt,
      eventId: "",
      attempts: -1,
      nextAttemptAt: endedAt + 1,
    })).toBeNull();
  });

  it("keeps callback identity private and stable while bounding retry delay", async () => {
    expect(typeof lifecycleApi.emptyRoomRetryAt).toBe("function");
    if (!lifecycleApi.emptyRoomRetryAt) return;

    const firstEventId = await createEmptyRoomEndEventId("room-1", 1_000);
    const repeatedEventId = await createEmptyRoomEndEventId("room-1", 1_000);
    expect(firstEventId).toBe(repeatedEventId);
    expect(firstEventId).toMatch(/^empty_timeout:[a-f0-9]{64}$/);
    expect(firstEventId).not.toContain("room-1");
    const firstDelay = lifecycleApi.emptyRoomRetryAt(1, 10_000) - 10_000;
    const lateDelay = lifecycleApi.emptyRoomRetryAt(10_000, 10_000) - 10_000;
    expect(firstDelay).toBeGreaterThan(0);
    expect(lateDelay).toBeGreaterThanOrEqual(firstDelay);
    expect(lateDelay).toBeLessThanOrEqual(30 * 60 * 1_000);
  });
});
