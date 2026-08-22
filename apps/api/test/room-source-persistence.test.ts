import type { RoomSourcePersistenceCallback } from "@anidachi/protocol";
import { describe, expect, it } from "vitest";
import { ROOM_LIFECYCLE_STORAGE_KEY, emptyRoomLifecycle } from "../src/room-lifecycle";
import {
  MAX_ROOM_SOURCE_PERSISTENCE_ATTEMPTS,
  ROOM_SOURCE_PENDING_STORAGE_KEY,
  acknowledgeStoredRoomSourceAttempt,
  claimStoredRoomSourceAttempt,
  enqueueStoredRoomSource,
  nextRoomAlarmAt,
  parsePendingRoomSourcePersistence,
  readStoredRoomSourcePersistence,
} from "../src/room-source-persistence";

describe("room source persistence outbox", () => {
  it("validates the exact shared callback before writing one KV record", async () => {
    const storage = new MemoryStorage();

    await expect(
      enqueueStoredRoomSource(
        storage.asDurableObjectStorage(),
        { ...callback(2), extra: true } as RoomSourcePersistenceCallback,
        100,
      ),
    ).rejects.toThrow("Invalid room source persistence callback");
    expect(storage.values.size).toBe(0);
  });

  it("coalesces only newer generations and rejects same-generation conflicts", async () => {
    const storage = new MemoryStorage();
    const durableStorage = storage.asDurableObjectStorage();

    await enqueueStoredRoomSource(durableStorage, callback(2), 200);
    expect(await readStoredRoomSourcePersistence(durableStorage)).toMatchObject({
      schemaVersion: 1,
      callback: callback(2),
      attempts: 0,
      nextAttemptAt: 200,
    });
    expect(storage.values.size).toBe(1);

    await enqueueStoredRoomSource(durableStorage, callback(1), 300);
    await enqueueStoredRoomSource(durableStorage, callback(2), 400);
    expect(await readStoredRoomSourcePersistence(durableStorage)).toMatchObject({
      callback: callback(2),
      nextAttemptAt: 200,
    });

    await expect(
      enqueueStoredRoomSource(
        durableStorage,
        {
          ...callback(2),
          source: {
            ...callback(2).source,
            canonicalUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
            sourceUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
            videoFingerprint: "youtube|aqz-KE-bpKQ",
          },
        },
        500,
      ),
    ).rejects.toThrow("Conflicting room source persistence generation");

    await enqueueStoredRoomSource(durableStorage, callback(3), 600);
    expect(await readStoredRoomSourcePersistence(durableStorage)).toMatchObject({
      callback: callback(3),
      attempts: 0,
      nextAttemptAt: 600,
    });
    expect(storage.values.size).toBe(1);
  });

  it("claims a due attempt by durably setting capped attempts and retry before I/O", async () => {
    const storage = new MemoryStorage();
    const durableStorage = storage.asDurableObjectStorage();
    await enqueueStoredRoomSource(durableStorage, callback(2), 1_000);

    const claim = await claimStoredRoomSourceAttempt(durableStorage, 1_000);
    const stored = storage.values.get(ROOM_SOURCE_PENDING_STORAGE_KEY);
    expect(claim).toEqual(stored);
    expect(claim).toMatchObject({ attempts: 1, callback: callback(2) });
    expect(claim?.nextAttemptAt).toBeGreaterThan(1_000);
    expect(storage.alarmAt).toBe(claim?.nextAttemptAt);
    await expect(claimStoredRoomSourceAttempt(durableStorage, 1_001)).resolves.toBeNull();

    storage.values.set(ROOM_SOURCE_PENDING_STORAGE_KEY, {
      schemaVersion: 1,
      callback: callback(2),
      attempts: MAX_ROOM_SOURCE_PERSISTENCE_ATTEMPTS,
      nextAttemptAt: 2_000,
    });
    const capped = await claimStoredRoomSourceAttempt(durableStorage, 2_000);
    expect(capped?.attempts).toBe(MAX_ROOM_SOURCE_PERSISTENCE_ATTEMPTS);
    expect(capped?.nextAttemptAt).toBeGreaterThan(2_000);
    expect(capped?.nextAttemptAt).toBeLessThanOrEqual(2_000 + 5 * 60_000);
  });

  it("clears only the exact acknowledged generation", async () => {
    const storage = new MemoryStorage();
    const durableStorage = storage.asDurableObjectStorage();
    await enqueueStoredRoomSource(durableStorage, callback(2), 100);
    await claimStoredRoomSourceAttempt(durableStorage, 100);
    await enqueueStoredRoomSource(durableStorage, callback(3), 200);

    await expect(acknowledgeStoredRoomSourceAttempt(durableStorage, 2)).resolves.toBe(false);
    expect(await readStoredRoomSourcePersistence(durableStorage)).toMatchObject({
      callback: callback(3),
    });
    await expect(acknowledgeStoredRoomSourceAttempt(durableStorage, 3)).resolves.toBe(true);
    expect(await readStoredRoomSourcePersistence(durableStorage)).toBeNull();
  });

  it("removes corrupt pending state without erasing a lifecycle deadline", async () => {
    const storage = new MemoryStorage();
    storage.values.set(ROOM_SOURCE_PENDING_STORAGE_KEY, {
      schemaVersion: 1,
      callback: { roomId: "room-1" },
      attempts: -1,
      nextAttemptAt: 0,
    });
    const lifecycle = emptyRoomLifecycle(100);
    storage.values.set(ROOM_LIFECYCLE_STORAGE_KEY, lifecycle);

    await expect(
      claimStoredRoomSourceAttempt(storage.asDurableObjectStorage(), 200),
    ).resolves.toBeNull();
    expect(storage.values.has(ROOM_SOURCE_PENDING_STORAGE_KEY)).toBe(false);
    expect(storage.alarmAt).toBe(lifecycle.alarmAt);
  });

  it("computes the single earliest logical alarm", () => {
    const pending = parsePendingRoomSourcePersistence({
      schemaVersion: 1,
      callback: callback(2),
      attempts: 0,
      nextAttemptAt: 500,
    });
    expect(pending).not.toBeNull();
    expect(nextRoomAlarmAt({ schemaVersion: 1, status: "active", updatedAt: 1 }, pending)).toBe(500);
    expect(nextRoomAlarmAt({ schemaVersion: 1, status: "empty", emptySince: 1, alarmAt: 900 }, pending)).toBe(500);
    expect(nextRoomAlarmAt({
      schemaVersion: 1,
      status: "ending",
      emptySince: 1,
      endedAt: 2,
      eventId: `empty_timeout:${"a".repeat(64)}`,
      attempts: 1,
      nextAttemptAt: 300,
    }, pending)).toBe(300);
    expect(nextRoomAlarmAt({ schemaVersion: 1, status: "ended", endedAt: 2, reason: "empty_timeout" }, null)).toBeNull();
  });
});

function callback(sourceGeneration: number): RoomSourcePersistenceCallback {
  const videoId = sourceGeneration === 3 ? "M7lc1UVf-VE" : "dQw4w9WgXcQ";
  return {
    roomId: "room-1",
    sourceGeneration,
    source: {
      provider: "youtube",
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      videoFingerprint: `youtube|${videoId}`,
    },
  };
}

class MemoryStorage {
  readonly values = new Map<string, unknown>();
  alarmAt: number | null = null;

  asDurableObjectStorage(): DurableObjectStorage {
    return this as unknown as DurableObjectStorage;
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.values.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<boolean> {
    return this.values.delete(key);
  }

  async setAlarm(scheduledTime: number): Promise<void> {
    this.alarmAt = scheduledTime;
  }

  async deleteAlarm(): Promise<void> {
    this.alarmAt = null;
  }

  async transaction<T>(closure: (transaction: DurableObjectTransaction) => Promise<T>): Promise<T> {
    return closure(this as unknown as DurableObjectTransaction);
  }
}
