import type { RoomSourcePersistenceCallback } from "@anidachi/protocol";
import { describe, expect, it } from "vitest";
import {
  activateStoredRoomLifecycle,
  claimStoredRoomEndAttempt,
  clearStoredRoomLifecycleAndAlarm,
  createStoredP2PReplayMetadata,
  markStoredRoomEmpty,
  parseRoomStateSnapshot,
} from "../src/room-persistence";
import { ROOM_LIFECYCLE_STORAGE_KEY, emptyRoomLifecycle } from "../src/room-lifecycle";
import {
  ROOM_SOURCE_PENDING_STORAGE_KEY,
  enqueueStoredRoomSource,
} from "../src/room-source-persistence";

const capabilities = {
  hostPlanCode: "pro",
  maxParticipants: 15,
  maxMediaSeats: 3,
  canNameRoom: true,
  canSendPushInvites: true,
} as const;

describe("room state persistence", () => {
  it("reduces durable P2P replay rows to privacy-safe metadata", () => {
    const metadata = createStoredP2PReplayMetadata(
      {
        type: "P2P_SIGNAL",
        clientSignalId: "raw-client-signal-id",
        fromUserId: "raw-user-a",
        roomId: "raw-room-id",
        roomGeneration: 3,
        senderConnectionId: "raw-connection-id",
        senderMediaSessionId: "raw-media-session-id",
        serverReceivedAt: 1_000,
        serverSeq: 8,
        signal: {
          kind: "offer",
          sdp: {
            type: "offer",
            sdp: "v=0\\r\\na=candidate:raw-peer-address\\r\\na=msid:raw-stream raw-track",
          },
        },
        sourceGeneration: 5,
        toUserId: "raw-user-b",
      },
      "hmac_dedupe_value",
    );
    const serialized = JSON.stringify(metadata);

    expect(metadata).toEqual({
      dedupeHash: "hmac_dedupe_value",
      roomGeneration: 3,
      serverReceivedAt: 1_000,
      serverSeq: 8,
      signalKind: "offer",
      sourceGeneration: 5,
    });
    for (const forbidden of [
      "raw-client-signal-id",
      "raw-user-a",
      "raw-user-b",
      "raw-room-id",
      "raw-connection-id",
      "raw-media-session-id",
      "raw-peer-address",
      "raw-stream",
      "raw-track",
      "candidate",
      "sdp",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("migrates legacy participants without mediaSeat once without rewriting explicit removals", () => {
    const legacy = parseRoomStateSnapshot({
      schemaVersion: 1,
      capabilities,
      hostId: "host",
      roomGeneration: 1,
      serverSeq: 5,
      sourceGeneration: 1,
      updatedAt: 1000,
      participants: [
        participant("host", "host"),
        participant("viewer-a", "viewer"),
        participant("viewer-b", "viewer"),
      ],
    });

    expect(legacy?.participants.map((item) => [item.id, item.mediaSeat])).toEqual([
      ["host", "joined"],
      ["viewer-a", "joined"],
      ["viewer-b", "joined"],
    ]);
    if (!legacy) {
      throw new Error("Expected legacy snapshot to parse");
    }

    const explicit = parseRoomStateSnapshot({
      ...legacy,
      participants: [
        { ...participant("host", "host"), mediaSeat: "joined", mediaSeatSource: "auto" },
        { ...participant("viewer-a", "viewer"), mediaSeat: "none" },
      ],
    });

    expect(explicit?.participants.find((item) => item.id === "viewer-a")?.mediaSeat).toBe("none");
    expect(explicit?.participants.find((item) => item.id === "viewer-a")?.cameraEnabled).toBe(
      false,
    );
  });

  it("keeps the source retry alarm when lifecycle becomes active", async () => {
    const storage = new MemoryStorage();
    await enqueueStoredRoomSource(storage.asDurableObjectStorage(), sourceCallback(2), 500);

    await expect(
      activateStoredRoomLifecycle(storage.asDurableObjectStorage(), 100),
    ).resolves.toMatchObject({ accepted: true, lifecycle: { status: "active" } });
    expect(storage.alarmAt).toBe(500);
  });

  it("schedules the earliest source or empty-room deadline", async () => {
    const storage = new MemoryStorage();
    await enqueueStoredRoomSource(storage.asDurableObjectStorage(), sourceCallback(2), 900);

    const empty = await markStoredRoomEmpty(storage.asDurableObjectStorage(), 100);
    expect(empty.status).toBe("empty");
    expect(storage.alarmAt).toBe(900);
  });

  it("does not claim a due room end while a valid source remains pending", async () => {
    const storage = new MemoryStorage();
    const lifecycle = emptyRoomLifecycle(100);
    storage.values.set(ROOM_LIFECYCLE_STORAGE_KEY, lifecycle);
    await enqueueStoredRoomSource(
      storage.asDurableObjectStorage(),
      sourceCallback(2),
      lifecycle.alarmAt + 100,
    );

    await expect(
      claimStoredRoomEndAttempt(
        storage.asDurableObjectStorage(),
        "room-1",
        lifecycle.alarmAt,
      ),
    ).resolves.toBeNull();
    expect(storage.values.get(ROOM_LIFECYCLE_STORAGE_KEY)).toMatchObject({ status: "empty" });
    expect(storage.alarmAt).toBe(lifecycle.alarmAt + 100);
  });

  it("clears lifecycle state without erasing a pending source retry", async () => {
    const storage = new MemoryStorage();
    storage.values.set(ROOM_LIFECYCLE_STORAGE_KEY, {
      schemaVersion: 1,
      status: "active",
      updatedAt: 100,
    });
    await enqueueStoredRoomSource(storage.asDurableObjectStorage(), sourceCallback(2), 700);

    await clearStoredRoomLifecycleAndAlarm(storage.asDurableObjectStorage());
    expect(storage.values.has(ROOM_LIFECYCLE_STORAGE_KEY)).toBe(false);
    expect(storage.values.has(ROOM_SOURCE_PENDING_STORAGE_KEY)).toBe(true);
    expect(storage.alarmAt).toBe(700);
  });

  it("removes a corrupt source record and lets a due lifecycle claim proceed", async () => {
    const storage = new MemoryStorage();
    const lifecycle = emptyRoomLifecycle(100);
    storage.values.set(ROOM_LIFECYCLE_STORAGE_KEY, lifecycle);
    storage.values.set(ROOM_SOURCE_PENDING_STORAGE_KEY, { schemaVersion: 1, callback: null });

    const claimed = await claimStoredRoomEndAttempt(
      storage.asDurableObjectStorage(),
      "room-1",
      lifecycle.alarmAt,
    );
    expect(claimed).toMatchObject({ status: "ending", attempts: 1 });
    expect(storage.values.has(ROOM_SOURCE_PENDING_STORAGE_KEY)).toBe(false);
    expect(storage.alarmAt).toBe(claimed?.nextAttemptAt);
  });
});

function participant(id: string, role: "host" | "viewer") {
  return {
    id,
    displayName: id,
    role,
    cameraEnabled: false,
    syncStatus: "unknown",
    lastSeenAt: 1000,
  };
}

function sourceCallback(sourceGeneration: number): RoomSourcePersistenceCallback {
  return {
    roomId: "room-1",
    sourceGeneration,
    source: {
      provider: "youtube",
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoFingerprint: "youtube|dQw4w9WgXcQ",
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
