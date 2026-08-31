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
  it.each(["alarm", "startup", "online", "initialize"] as const)(
    "pre-arms an alarm before deferred auth from %s and safely resumes",
    async (trigger) => {
      const storage = createPersistentStorage();
      const scheduler = createScheduler();
      const auth = deferred<string | null>();
      let now = 500;
      const getCurrentUserId = vi.fn(() => auth.promise);
      const departExact = vi
        .fn<() => Promise<"retryable" | "departed">>()
        .mockResolvedValueOnce("retryable")
        .mockResolvedValueOnce("departed");
      const coordinator = createRoomDepartureRetryCoordinator({
        storage,
        scheduler,
        getCurrentUserId,
        departExact,
        now: () => now,
      });

      await coordinator.renewAdmissionIntent(OLD_SESSION);
      now = scheduler.when() as number;
      scheduler.consume();
      const draining = trigger === "alarm"
        ? coordinator.handleAlarm(ROOM_DEPARTURE_RETRY_ALARM)
        : coordinator.drain({ force: trigger !== "initialize" });
      await waitUntil(() => getCurrentUserId.mock.calls.length === 1);

      expect(scheduler.when()).not.toBeNull();
      auth.resolve("user-a");
      await draining;

      now = 500 + ROOM_ADMISSION_SETTLEMENT_HORIZON_MS;
      await coordinator.drain({ force: true });
      expect(storage.value()).toBeNull();
    },
  );

  it("pre-arms an alarm before deferred departure from an alarm drain", async () => {
    const storage = createPersistentStorage();
    const scheduler = createScheduler();
    const firstDeparture = deferred<"retryable">();
    let now = 800;
    const departExact = vi
      .fn<() => Promise<"retryable" | "departed">>()
      .mockImplementationOnce(() => firstDeparture.promise)
      .mockResolvedValueOnce("departed");
    const coordinator = createRoomDepartureRetryCoordinator({
      storage,
      scheduler,
      getCurrentUserId: async () => "user-a",
      departExact,
      now: () => now,
    });

    await coordinator.renewAdmissionIntent(OLD_SESSION);
    now = scheduler.when() as number;
    scheduler.consume();
    const draining = coordinator.handleAlarm(ROOM_DEPARTURE_RETRY_ALARM);
    await waitUntil(() => departExact.mock.calls.length === 1);

    expect(scheduler.when()).not.toBeNull();
    firstDeparture.resolve("retryable");
    await draining;

    now = 800 + ROOM_ADMISSION_SETTLEMENT_HORIZON_MS;
    await coordinator.drain({ force: true });
    expect(storage.value()).toBeNull();
  });

  it("renews a settled same-identity job before a later canceled admission", async () => {
    const storage = createPersistentStorage();
    const scheduler = createScheduler();
    let now = 2_000;
    let lateAssignmentActive = false;
    const departExact = vi
      .fn<() => Promise<"stale" | "departed" | "retryable">>(async () => {
        if (!lateAssignmentActive) return "stale" as const;
        lateAssignmentActive = false;
        return "departed" as const;
      })
      .mockResolvedValueOnce("retryable");
    const coordinator = createRoomDepartureRetryCoordinator({
      storage,
      scheduler,
      getCurrentUserId: async () => "user-a",
      departExact,
      now: () => now,
    });

    const first = await coordinator.renewAdmissionIntent(OLD_SESSION);
    await expect(coordinator.settleAdmission(first)).resolves.toBe("retryable");
    expect(storage.value()?.jobs[0]?.admissionState).toBe("settled");

    now += 1_000;
    const second = await coordinator.renewAdmissionIntent(OLD_SESSION);
    expect(second.generation).toBe(first.generation + 1);
    expect(storage.value()?.jobs[0]).toMatchObject({
      admissionState: "may-commit",
      generation: second.generation,
      settleAfter: now + ROOM_ADMISSION_SETTLEMENT_HORIZON_MS,
    });

    await expect(coordinator.settleAdmission(first)).resolves.toBe(
      "active-room-changed",
    );
    await expect(coordinator.retryAdmission(second)).resolves.toBe("stale");
    expect(storage.value()?.jobs[0]).toMatchObject({
      admissionState: "may-commit",
      generation: second.generation,
    });

    lateAssignmentActive = true;
    await expect(coordinator.settleAdmission(second)).resolves.toBe("departed");
    expect(lateAssignmentActive).toBe(false);
    expect(storage.value()).toBeNull();
  });
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

    await firstWorker.renewAdmissionIntent(OLD_SESSION);
    expect(ROOM_ADMISSION_SETTLEMENT_HORIZON_MS).toBe(135_000);
    expect(storage.value()).toMatchObject({
      version: 3,
      jobs: [
        {
          ...OLD_SESSION,
          admissionState: "may-commit",
          generation: 1,
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

    const operation = await coordinator.renewAdmissionIntent(OLD_SESSION);
    await coordinator.drain({ force: true });
    expect(departExact).toHaveBeenCalledTimes(1);
    expect(storage.value()?.jobs).toHaveLength(1);

    oldAssignmentActive = true;
    await expect(coordinator.settleAdmission(operation)).resolves.toBe("departed");

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

    const operation = await coordinator.renewAdmissionIntent(OLD_SESSION);
    const settling = coordinator.settleAdmission(operation);
    await waitUntil(() => scheduler.when() === 25_000);

    expect(storage.value()?.jobs[0]?.admissionState).toBe("settled");
    expect(scheduler.when()).toBe(25_000);
    departure.resolve("departed");
    await expect(settling).resolves.toBe("departed");
  });

  it("durably re-arms an ambiguous job before awaiting its exact network retry", async () => {
    const storage = createPersistentStorage();
    const scheduler = createScheduler();
    const departure = deferred<"stale">();
    const coordinator = createRoomDepartureRetryCoordinator({
      storage,
      scheduler,
      getCurrentUserId: async () => "user-a",
      departExact: async () => departure.promise,
      now: () => 26_000,
    });

    const operation = await coordinator.renewAdmissionIntent(OLD_SESSION);
    const retrying = coordinator.retryAdmission(operation);
    await waitUntil(() => scheduler.when() === 26_000);

    expect(storage.value()?.jobs[0]?.admissionState).toBe("may-commit");
    departure.resolve("stale");
    await expect(retrying).resolves.toBe("stale");
    expect(storage.value()?.jobs).toHaveLength(1);
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

    const operation = await coordinator.renewAdmissionIntent(OLD_SESSION);
    await coordinator.drain({ force: true });

    expect(storage.value()?.jobs).toHaveLength(1);
    expect(scheduler.when()).toBeNull();
    expect(departExact).not.toHaveBeenCalled();

    currentUserId = "user-a";
    await expect(coordinator.settleAdmission(operation)).resolves.toBe("stale");
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

    const operation = await coordinator.renewAdmissionIntent(OLD_SESSION);
    await coordinator.settleAdmission(operation);

    expect(departExact).toHaveBeenCalledWith(OLD_SESSION);
    expect(replacement).toEqual({
      roomId: "room-new",
      ownerUserId: "user-a",
      participantSessionId: "session-new",
      active: true,
    });
    expect(storage.value()).toBeNull();
  });

  it("renews repeated same-identity intents and caps retry backoff", async () => {
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

    const first = await coordinator.renewAdmissionIntent(OLD_SESSION);
    const second = await coordinator.renewAdmissionIntent(OLD_SESSION);
    expect(second.generation).toBe(first.generation + 1);
    expect(storage.value()?.jobs).toHaveLength(1);

    await coordinator.settleAdmission(second);
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

    const operation = await coordinator.renewAdmissionIntent(OLD_SESSION);
    await coordinator.settleAdmission(operation);

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
    consume() {
      scheduledAt = null;
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
