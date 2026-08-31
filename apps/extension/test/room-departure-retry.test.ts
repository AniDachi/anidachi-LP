import { describe, expect, it, vi } from "vitest";
import {
  ROOM_ADMISSION_SETTLEMENT_HORIZON_MS,
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
  it("survives worker recreation before admission settlement and exact-cleans a late commit", async () => {
    const storage = createPersistentStorage();
    const firstScheduler = createScheduler();
    let now = 1_000;
    const firstWorker = createRoomDepartureRetryCoordinator({
      storage,
      scheduler: firstScheduler,
      getCurrentUserId: async () => "user-a",
      departExact: vi.fn(),
      now: () => now,
    });

    await firstWorker.persistAdmissionIntent(OLD_SESSION);
    expect(storage.value()).toMatchObject({
      version: 2,
      jobs: [
        {
          ...OLD_SESSION,
          admissionState: "may-commit",
          settleAfter: now + ROOM_ADMISSION_SETTLEMENT_HORIZON_MS,
        },
      ],
    });

    let oldAssignmentActive = true;
    const restartedScheduler = createScheduler();
    const departExact = vi.fn(async (identity: RoomDepartureRetryIdentity) => {
      expect(identity).toEqual(OLD_SESSION);
      if (!oldAssignmentActive) return "stale" as const;
      oldAssignmentActive = false;
      return "departed" as const;
    });
    const restartedWorker = createRoomDepartureRetryCoordinator({
      storage,
      scheduler: restartedScheduler,
      getCurrentUserId: async () => "user-a",
      departExact,
      now: () => now,
    });

    now = firstScheduler.when() as number;
    await restartedWorker.handleAlarm(ROOM_DEPARTURE_RETRY_ALARM);

    expect(oldAssignmentActive).toBe(false);
    expect(departExact).toHaveBeenCalledOnce();
    expect(storage.value()?.jobs).toHaveLength(1);

    now = 1_000 + ROOM_ADMISSION_SETTLEMENT_HORIZON_MS;
    await restartedWorker.drain({ force: true });
    expect(storage.value()).toBeNull();
    expect(restartedScheduler.when()).toBeNull();
  });

  it("keeps the job after pre-settlement stale, then removes a late commit by exact retry", async () => {
    const storage = createPersistentStorage();
    const scheduler = createScheduler();
    let oldAssignmentActive = false;
    const departExact = vi.fn(async () => {
      if (!oldAssignmentActive) return "stale" as const;
      oldAssignmentActive = false;
      return "departed" as const;
    });
    const coordinator = createRoomDepartureRetryCoordinator({
      storage,
      scheduler,
      getCurrentUserId: async () => "user-a",
      departExact,
      now: () => 10_000,
    });

    await coordinator.persistAdmissionIntent(OLD_SESSION);
    await coordinator.drain({ force: true });
    expect(departExact).toHaveBeenCalledTimes(1);
    expect(storage.value()?.jobs).toHaveLength(1);

    oldAssignmentActive = true;
    await expect(coordinator.settleAdmission(OLD_SESSION)).resolves.toBe("departed");

    expect(departExact).toHaveBeenCalledTimes(2);
    expect(oldAssignmentActive).toBe(false);
    expect(storage.value()).toBeNull();
  });

  it("durably re-arms a settled job before awaiting its exact network drain", async () => {
    const storage = createPersistentStorage();
    const scheduler = createScheduler();
    const departure = deferred<"departed">();
    const coordinator = createRoomDepartureRetryCoordinator({
      storage,
      scheduler,
      getCurrentUserId: async () => "user-a",
      departExact: async () => departure.promise,
      now: () => 25_000,
    });

    await coordinator.persistAdmissionIntent(OLD_SESSION);
    const settling = coordinator.settleAdmission(OLD_SESSION);
    await waitUntil(() => scheduler.when() === 25_000);

    expect(storage.value()?.jobs[0]?.admissionState).toBe("settled");
    expect(scheduler.when()).toBe(25_000);
    departure.resolve("departed");
    await expect(settling).resolves.toBe("departed");
  });

  it("retains a blocked account without a forever alarm and wakes on an auth-triggered drain", async () => {
    const storage = createPersistentStorage();
    const scheduler = createScheduler();
    let currentUserId: string | null = null;
    const departExact = vi.fn(async () => "stale" as const);
    const coordinator = createRoomDepartureRetryCoordinator({
      storage,
      scheduler,
      getCurrentUserId: async () => currentUserId,
      departExact,
      now: () => 50_000,
    });

    await coordinator.persistAdmissionIntent(OLD_SESSION);
    await coordinator.drain({ force: true });

    expect(storage.value()?.jobs).toHaveLength(1);
    expect(scheduler.when()).toBeNull();
    expect(departExact).not.toHaveBeenCalled();

    currentUserId = "user-a";
    await expect(coordinator.settleAdmission(OLD_SESSION)).resolves.toBe("stale");
    expect(departExact).toHaveBeenCalledOnce();
    expect(storage.value()).toBeNull();
  });

  it("fences cleanup to the old participant session and never touches its replacement", async () => {
    const storage = createPersistentStorage();
    const replacement = {
      roomId: "room-new",
      ownerUserId: "user-a",
      participantSessionId: "session-new",
      active: true,
    };
    const departExact = vi.fn(async (identity: RoomDepartureRetryIdentity) => {
      expect(identity).toEqual(OLD_SESSION);
      return "active-room-changed" as const;
    });
    const coordinator = createRoomDepartureRetryCoordinator({
      storage,
      scheduler: createScheduler(),
      getCurrentUserId: async () => "user-a",
      departExact,
      now: () => 100_000,
    });

    await coordinator.persistAdmissionIntent(OLD_SESSION);
    await coordinator.settleAdmission(OLD_SESSION);

    expect(departExact).toHaveBeenCalledWith(OLD_SESSION);
    expect(replacement).toEqual({
      roomId: "room-new",
      ownerUserId: "user-a",
      participantSessionId: "session-new",
      active: true,
    });
    expect(storage.value()).toBeNull();
  });

  it("coalesces duplicate cancellation intents and caps retry backoff", async () => {
    const storage = createPersistentStorage();
    const scheduler = createScheduler();
    let now = 150_000;
    const coordinator = createRoomDepartureRetryCoordinator({
      storage,
      scheduler,
      getCurrentUserId: async () => "user-a",
      departExact: async () => "retryable",
      now: () => now,
    });

    await coordinator.persistAdmissionIntent(OLD_SESSION);
    await coordinator.persistAdmissionIntent(OLD_SESSION);
    expect(storage.value()?.jobs).toHaveLength(1);

    await coordinator.settleAdmission(OLD_SESSION);
    for (let attempt = 1; attempt < 12; attempt += 1) {
      const nextAttemptAt = storage.value()?.jobs[0]?.nextAttemptAt;
      expect(typeof nextAttemptAt).toBe("number");
      expect((nextAttemptAt as number) - now).toBeLessThanOrEqual(60 * 60_000);
      now = nextAttemptAt as number;
      await coordinator.drain();
    }

    expect(storage.value()?.jobs[0]?.attempts).toBe(12);
  });

  it.each([
    "departed",
    "room_ended",
    "already_departed",
    "stale",
    "active-room-changed",
  ] as const)("removes a settled exact retry after terminal %s", async (outcome) => {
    const storage = createPersistentStorage();
    const coordinator = createRoomDepartureRetryCoordinator({
      storage,
      scheduler: createScheduler(),
      getCurrentUserId: async () => "user-a",
      departExact: async () => outcome,
      now: () => 200_000,
    });

    await coordinator.persistAdmissionIntent(OLD_SESSION);
    await coordinator.settleAdmission(OLD_SESSION);

    expect(storage.value()).toBeNull();
  });
});

function createPersistentStorage() {
  let stored: { version: number; jobs: Array<Record<string, unknown>> } | null = null;
  return {
    async read() {
      return stored;
    },
    async write(value: { version: number; jobs: Array<Record<string, unknown>> }) {
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error("condition did not become true");
}
