import { describe, expect, it } from "vitest";
import {
  createWatchHistoryStorage,
  createWatchHistoryStorageRoot,
  watchHistoryPartitionKey,
  type WatchHistoryStorageRoot,
} from "../src/watch-history-storage";

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";

describe("watch history storage", () => {
  it("retains unacknowledged old-owner outbox work while deleting rebuildable account data", async () => {
    let stored: WatchHistoryStorageRoot = createWatchHistoryStorageRoot();
    const store = createWatchHistoryStorage({
      item: {
        getValue: async () => stored,
        setValue: async (value) => {
          stored = value;
        },
      },
      getBytesInUse: async () => 0,
      quotaBytes: 1_000_000,
    });
    await store.replaceRoot({
      schemaVersion: 2,
      partitions: {
        [watchHistoryPartitionKey(ownerA, 1)]: {
          ownerUserId: ownerA,
          accountGeneration: 1,
          cache: { generation: 1 },
          preferences: { youtubeHistoryEnabled: true },
          currentObservation: { clientEventId: "event-a" },
          outbox: { ownerUserId: ownerA, accountGeneration: 1, entries: [{ event: { clientEventId: "event-a" } }] },
        },
        [watchHistoryPartitionKey(ownerB, 2)]: {
          ownerUserId: ownerB,
          accountGeneration: 2,
          cache: { generation: 2 },
          preferences: { youtubeHistoryEnabled: false },
          currentObservation: null,
          outbox: { ownerUserId: ownerB, accountGeneration: 2, entries: [] },
        },
      },
    } as unknown as WatchHistoryStorageRoot);

    await store.clearRebuildableAccountData(ownerA);

    expect(stored.partitions[watchHistoryPartitionKey(ownerA, 1)]).toMatchObject({
      cache: null,
      preferences: null,
      currentObservation: null,
      outbox: { entries: [{ event: { clientEventId: "event-a" } }] },
    });
    expect(stored.partitions[watchHistoryPartitionKey(ownerB, 2)]).toMatchObject({ cache: { generation: 2 } });
  });

  it("refuses an unpersisted candidate at quota without evicting dormant accounts or unrelated keys", async () => {
    let stored = createWatchHistoryStorageRoot();
    const writes: WatchHistoryStorageRoot[] = [];
    const store = createWatchHistoryStorage({
      item: {
        getValue: async () => stored,
        setValue: async (value) => {
          writes.push(value);
          stored = value;
        },
      },
      getBytesInUse: async () => 100,
      quotaBytes: 90,
      serialize: () => "candidate-that-cannot-fit",
    });

    const result = await store.replaceRoot({
      schemaVersion: 2,
      partitions: {
        [watchHistoryPartitionKey(ownerA, 1)]: {
          ownerUserId: ownerA,
          accountGeneration: 1,
          cache: null,
          preferences: null,
          currentObservation: null,
          outbox: { ownerUserId: ownerA, accountGeneration: 1, entries: [] },
        },
        [watchHistoryPartitionKey(ownerB, 1)]: {
          ownerUserId: ownerB,
          accountGeneration: 1,
          cache: null,
          preferences: null,
          currentObservation: null,
          outbox: { ownerUserId: ownerB, accountGeneration: 1, entries: [] },
        },
      },
    });

    expect(result).toEqual({ ok: false, status: "storage-full" });
    expect(writes).toEqual([]);
    expect(stored.partitions).toEqual({});
  });

  it("reports only aggregate old-owner work and requires confirmation for its discard", async () => {
    let stored = {
      schemaVersion: 2 as const,
      partitions: {
        [watchHistoryPartitionKey(ownerA, 1)]: {
          ownerUserId: ownerA,
          accountGeneration: 1,
          cache: null,
          preferences: null,
          currentObservation: null,
          outbox: {
            ownerUserId: ownerA,
            accountGeneration: 1,
            entries: [{ event: { title: "Private title", sourceUrl: "https://example.test/private" } }],
          },
        },
      },
    } as unknown as WatchHistoryStorageRoot;
    const store = createWatchHistoryStorage({
      item: {
        getValue: async () => stored,
        setValue: async (value) => {
          stored = value;
        },
      },
      getBytesInUse: async () => 0,
      quotaBytes: 1_000_000,
    });

    await expect(store.discardOtherOwnerOutbox(ownerB, ownerA, false)).rejects.toThrow("confirmation");
    await expect(store.otherOwnerPendingSummary(ownerB)).resolves.toMatchObject({ hasPendingWork: true });
    const summary = await store.otherOwnerPendingSummary(ownerB);
    expect(Object.keys(summary)).toEqual(["hasPendingWork", "byteUse"]);
    await expect(store.discardOtherOwnerOutbox(ownerB, ownerA, true)).resolves.toEqual({ ok: true });
    expect(stored.partitions).toEqual({});
  });

  it("surfaces a failed write as storage-full and recovers without discarding existing state", async () => {
    let stored = createWatchHistoryStorageRoot();
    let shouldFail = true;
    const store = createWatchHistoryStorage({
      item: {
        getValue: async () => stored,
        setValue: async (value) => {
          if (shouldFail) throw new Error("quota");
          stored = value;
        },
      },
      getBytesInUse: async () => 0,
      quotaBytes: 1_000_000,
    });
    const candidate = {
      schemaVersion: 2 as const,
      partitions: {
        [watchHistoryPartitionKey(ownerA, 1)]: {
          ownerUserId: ownerA,
          accountGeneration: 1,
          cache: null,
          preferences: null,
          currentObservation: null,
          outbox: { ownerUserId: ownerA, accountGeneration: 1, entries: [] },
        },
      },
    } satisfies WatchHistoryStorageRoot;

    await expect(store.replaceRoot(candidate)).resolves.toEqual({ ok: false, status: "storage-full" });
    expect(stored).toEqual(createWatchHistoryStorageRoot());
    shouldFail = false;
    await expect(store.replaceRoot(candidate)).resolves.toEqual({ ok: true });
    expect(stored).toEqual(candidate);
  });
});
