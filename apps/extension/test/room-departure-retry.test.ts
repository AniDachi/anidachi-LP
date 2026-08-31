import { describe, expect, it, vi } from "vitest";
import {
  ROOM_DEPARTURE_RETRY_ALARM,
  createRoomDepartureRetryCoordinator,
  type RoomDepartureRetryIdentity,
} from "../src/room-departure-retry";

const OLD_SESSION: RoomDepartureRetryIdentity = {
  roomId: "room-old",
  ownerUserId: "user-a",
  participantSessionId: "session-old",
};

describe("room departure retry coordinator", () => {
  it("persists one coalesced exact job and drains it after a service-worker restart", async () => {
    const storage = createPersistentStorage();
    const firstScheduler = createScheduler();
    let now = 1_000;
    const first = createRoomDepartureRetryCoordinator({
      storage,
      scheduler: firstScheduler,
      getCurrentUserId: async () => null,
      departExact: vi.fn(),
      now: () => now,
    });

    await first.enqueue(OLD_SESSION);
    await first.enqueue(OLD_SESSION);

    expect(storage.value()?.jobs).toHaveLength(1);
    expect(Object.keys(storage.value()?.jobs[0] ?? {}).sort()).toEqual([
      "attempts",
      "createdAt",
      "nextAttemptAt",
      "ownerUserId",
      "participantSessionId",
      "roomId",
    ]);
    expect(firstScheduler.when()).toBeGreaterThan(now);

    now = firstScheduler.when() as number;
    await first.drain();
    expect(storage.value()?.jobs).toHaveLength(1);

    const restartedScheduler = createScheduler();
    const departExact = vi.fn(async () => "departed" as const);
    const restarted = createRoomDepartureRetryCoordinator({
      storage,
      scheduler: restartedScheduler,
      getCurrentUserId: async () => "user-a",
      departExact,
      now: () => now,
    });
    now += 5 * 60_000;

    await expect(restarted.handleAlarm(ROOM_DEPARTURE_RETRY_ALARM)).resolves.toBe(true);

    expect(departExact).toHaveBeenCalledOnce();
    expect(departExact).toHaveBeenCalledWith(OLD_SESSION);
    expect(storage.value()).toBeNull();
    expect(restartedScheduler.when()).toBeNull();
  });

  it("retains a job for another account and removes it only after exact stale fencing", async () => {
    const storage = createPersistentStorage();
    const scheduler = createScheduler();
    let now = 10_000;
    let currentUserId: string | null = "user-b";
    const replacement = {
      roomId: "room-new",
      ownerUserId: "user-a",
      participantSessionId: "session-new",
    };
    const departExact = vi.fn(async (identity: RoomDepartureRetryIdentity) => {
      expect(identity).toEqual(OLD_SESSION);
      return "stale" as const;
    });
    const coordinator = createRoomDepartureRetryCoordinator({
      storage,
      scheduler,
      getCurrentUserId: async () => currentUserId,
      departExact,
      now: () => now,
    });

    await coordinator.enqueue(OLD_SESSION);
    now = scheduler.when() as number;
    await coordinator.drain();

    expect(departExact).not.toHaveBeenCalled();
    expect(storage.value()?.jobs).toHaveLength(1);

    currentUserId = "user-a";
    await coordinator.drain({ force: true });

    expect(departExact).toHaveBeenCalledOnce();
    expect(storage.value()).toBeNull();
    expect(replacement).toEqual({
      roomId: "room-new",
      ownerUserId: "user-a",
      participantSessionId: "session-new",
    });
  });

  it("caps retry backoff while retaining an unconfirmed exact departure", async () => {
    const storage = createPersistentStorage();
    const scheduler = createScheduler();
    let now = 50_000;
    const coordinator = createRoomDepartureRetryCoordinator({
      storage,
      scheduler,
      getCurrentUserId: async () => "user-a",
      departExact: async () => "retryable",
      now: () => now,
    });

    await coordinator.enqueue(OLD_SESSION);
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await coordinator.drain({ force: true });
      const nextAttemptAt = storage.value()?.jobs[0]?.nextAttemptAt;
      expect(typeof nextAttemptAt).toBe("number");
      expect((nextAttemptAt as number) - now).toBeLessThanOrEqual(60 * 60_000);
      now = nextAttemptAt as number;
    }

    expect(storage.value()?.jobs[0]?.attempts).toBe(12);
  });

  it.each([
    "departed",
    "room_ended",
    "already_departed",
    "stale",
    "active-room-changed",
  ] as const)("removes the exact retry after terminal %s", async (outcome) => {
    const storage = createPersistentStorage();
    const coordinator = createRoomDepartureRetryCoordinator({
      storage,
      scheduler: createScheduler(),
      getCurrentUserId: async () => "user-a",
      departExact: async () => outcome,
      now: () => 100_000,
    });

    await coordinator.enqueue(OLD_SESSION);
    await coordinator.drain({ force: true });

    expect(storage.value()).toBeNull();
  });
});

function createPersistentStorage() {
  let stored: { version: 1; jobs: Array<Record<string, unknown>> } | null = null;
  return {
    async read() {
      return stored;
    },
    async write(value: { version: 1; jobs: Array<Record<string, unknown>> }) {
      stored = structuredClone(value);
    },
    async clear() {
      stored = null;
    },
    value() {
      return stored;
    },
  };
}

function createScheduler() {
  let scheduledAt: number | null = null;
  return {
    async replace(when: number | null) {
      scheduledAt = when;
    },
    when() {
      return scheduledAt;
    },
  };
}
