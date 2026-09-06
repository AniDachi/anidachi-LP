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
  it.each([false, true])("retries interrupted legacy cleanup, preserving new v3 state (restart=%s)", async (restart) => {
    const key = watchHistoryPartitionKey(ownerA, 1);
    const values: Record<string, unknown> = {
      "anidachi.watchHistory.v2": { schemaVersion: 2, partitions: { [key]: {
        ownerUserId: ownerA, accountGeneration: 1,
        preferences: { youtubeHistoryEnabled: true }, preferencesConfirmed: true,
      } } },
      "unrelated.setting": { retained: true },
    };
    let removals = 0;
    const dependencies = {
      item: {
        getValue: async () => values["anidachi.watchHistory.v3"] as WatchHistoryStorageRoot ?? null,
        setValue: async (value: WatchHistoryStorageRoot) => { values["anidachi.watchHistory.v3"] = value; },
      },
      readLegacy: async () => values["anidachi.watchHistory.v2"],
      removeLegacy: async () => {
        expect(values["anidachi.watchHistory.v3"]).toBeDefined();
        if (++removals === 1) throw new Error("injected remove failure");
        delete values["anidachi.watchHistory.v2"];
      },
      quotaBytes: 1_000_000, getBytesInUse: async () => 0,
    };
    let storage = createWatchHistoryStorage(dependencies);
    await expect(storage.readRoot()).rejects.toThrow("injected remove failure");
    const root = values["anidachi.watchHistory.v3"] as WatchHistoryStorageRoot;
    root.partitions[key]!.preferences = { youtubeHistoryEnabled: false };
    root.partitions[key]!.preferencesLocalRevision = 7;
    root.partitions[key]!.currentObservation = { clientEventId: "new-v3-progress" } as never;
    const preserved = structuredClone(root);
    if (restart) storage = createWatchHistoryStorage(dependencies);
    await storage.readRoot();
    expect(removals).toBe(2);
    expect(values).not.toHaveProperty("anidachi.watchHistory.v2");
    expect(values["anidachi.watchHistory.v3"]).toEqual(preserved);
    expect(values["unrelated.setting"]).toEqual({ retained: true });
    await storage.readRoot();
    expect(removals).toBe(2);
  });
  it("upgrades only validated account preferences and discards all v2 history once", async () => {
    let stored: WatchHistoryStorageRoot | null = null;
    let legacy: unknown = { schemaVersion: 2, partitions: {
      [watchHistoryPartitionKey(ownerA, 1)]: {
        ownerUserId: ownerA, accountGeneration: 1,
        preferences: { youtubeHistoryEnabled: false }, preferencesConfirmed: true,
        preferencesSyncPending: true, preferencesLocalRevision: 4,
        cache: { private: "old" }, currentObservation: { old: true },
        outbox: { entries: [{ old: true }] },
      },
      [watchHistoryPartitionKey(ownerB, 2)]: {
        ownerUserId: ownerB, accountGeneration: 2,
        preferences: { youtubeHistoryEnabled: true }, preferencesConfirmed: true,
      },
      invalid: { ownerUserId: ownerA, accountGeneration: 9, preferences: { youtubeHistoryEnabled: true } },
    } };
    let removals = 0;
    const storage = createWatchHistoryStorage({
      item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
      readLegacy: async () => legacy,
      removeLegacy: async () => { legacy = null; removals += 1; },
      quotaBytes: 1_000_000, getBytesInUse: async () => 0,
    });
    const root = await storage.readRoot();
    expect(root.schemaVersion).toBe(3);
    expect(root.partitions[watchHistoryPartitionKey(ownerA, 1)]).toMatchObject({
      preferences: { youtubeHistoryEnabled: false }, preferencesSyncPending: true,
      preferencesLocalRevision: 4, cache: null, currentObservation: null,
      outbox: { entries: [] }, capturePaused: true,
    });
    expect(root.partitions[watchHistoryPartitionKey(ownerB, 2)]?.preferences?.youtubeHistoryEnabled).toBe(true);
    expect(root.partitions).not.toHaveProperty("invalid");
    await storage.readRoot();
    expect(removals).toBe(1);
  });
  it("normalizes pre-release roots with fixed capture and confirmed-preference flags", async () => {
    const partitionKey = watchHistoryPartitionKey(ownerA, 1);
    const stored = {
      schemaVersion: 3 as const,
      activeGenerations: { [ownerA]: 1 },
      partitions: {
        [partitionKey]: {
          ownerUserId: ownerA,
          accountGeneration: 1,
          cache: null,
          preferences: { youtubeHistoryEnabled: false },
          currentObservation: { clientEventId: "legacy-observation" } as never,
          outbox: { ownerUserId: ownerA, accountGeneration: 1, entries: [] },
        },
      },
    } as WatchHistoryStorageRoot;
    const store = createWatchHistoryStorage({
      item: { getValue: async () => stored, setValue: async () => undefined },
      getBytesInUse: async () => 0,
      quotaBytes: 1_000_000,
    });

    const normalized = await store.readRoot();
    expect(normalized.partitions[partitionKey]).toMatchObject({
      capturePaused: true,
      preferencesConfirmed: false,
      captureMarkersReady: false,
      currentObservationMeaningfulSolo: false,
      currentObservationDisplayMode: null,
    });
  });

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
      schemaVersion: 3,
      partitions: {
        [watchHistoryPartitionKey(ownerA, 1)]: {
          ownerUserId: ownerA,
          accountGeneration: 1,
          cache: { generation: 1 },
          preferences: { youtubeHistoryEnabled: true },
          currentObservation: { clientEventId: "event-a" },
          currentObservationMeaningfulSolo: true,
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
      currentObservationMeaningfulSolo: false,
      currentObservationDisplayMode: null,
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
      schemaVersion: 3,
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

  it("counts a first root write in addition to unrelated local bytes", async () => {
    let stored: WatchHistoryStorageRoot | null = null;
    const candidate = createWatchHistoryStorageRoot();
    const keyBytes = new TextEncoder().encode("anidachi.watchHistory.v3").byteLength;
    const store = createWatchHistoryStorage({
      item: {
        getValue: async () => stored,
        setValue: async (value) => { stored = value; },
      },
      hasStoredRoot: async () => false,
      getBytesInUse: async () => 100,
      quotaBytes: 100 + keyBytes + new TextEncoder().encode(JSON.stringify(candidate)).byteLength - 1,
    });

    await expect(store.replaceRoot(candidate)).resolves.toEqual({ ok: false, status: "storage-full" });
    expect(stored).toBeNull();
  });

  it("subtracts exactly one existing root entry when replacing it", async () => {
    let stored = createWatchHistoryStorageRoot();
    const candidate = {
      ...stored,
      partitions: { retained: {} as never },
    };
    const keyBytes = new TextEncoder().encode("anidachi.watchHistory.v3").byteLength;
    const existingBytes = keyBytes + new TextEncoder().encode(JSON.stringify(stored)).byteLength;
    const candidateBytes = keyBytes + new TextEncoder().encode(JSON.stringify(candidate)).byteLength;
    const store = createWatchHistoryStorage({
      item: {
        getValue: async () => stored,
        setValue: async (value) => { stored = value; },
      },
      hasStoredRoot: async () => true,
      getBytesInUse: async () => 900 + existingBytes,
      quotaBytes: 900 + candidateBytes,
    });

    await expect(store.replaceRoot(candidate)).resolves.toEqual({ ok: true });
    expect(stored).toEqual(candidate);
  });

  it("reports only aggregate old-owner work and requires confirmation for its discard", async () => {
    let stored = {
      schemaVersion: 3 as const,
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

  it("discards every non-current outbox only after aggregate confirmation", async () => {
    const ownerC = "00000000-0000-4000-8000-000000000003";
    const currentKey = watchHistoryPartitionKey(ownerB, 1);
    const retainedOldKey = watchHistoryPartitionKey(ownerA, 1);
    const removableOldKey = watchHistoryPartitionKey(ownerC, 1);
    let stored = {
      schemaVersion: 3 as const,
      activeGenerations: { [ownerA]: 1, [ownerB]: 1, [ownerC]: 1 },
      partitions: {
        [currentKey]: {
          ownerUserId: ownerB,
          accountGeneration: 1,
          cache: null,
          preferences: null,
          currentObservation: null,
          outbox: { ownerUserId: ownerB, accountGeneration: 1, entries: [{ event: { clientEventId: "current" } }] },
        },
        [retainedOldKey]: {
          ownerUserId: ownerA,
          accountGeneration: 1,
          cache: { retained: true },
          preferences: null,
          currentObservation: null,
          outbox: { ownerUserId: ownerA, accountGeneration: 1, entries: [{ event: { clientEventId: "old-a" } }] },
        },
        [removableOldKey]: {
          ownerUserId: ownerC,
          accountGeneration: 1,
          cache: null,
          preferences: null,
          currentObservation: null,
          outbox: { ownerUserId: ownerC, accountGeneration: 1, entries: [{ event: { clientEventId: "old-c" } }] },
        },
      },
    } as unknown as WatchHistoryStorageRoot;
    const store = createWatchHistoryStorage({
      item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
      getBytesInUse: async () => 0,
      quotaBytes: 1_000_000,
    });

    await expect(store.discardAllOtherOwnerOutboxes(ownerB, false)).rejects.toThrow("confirmation");
    expect(stored.partitions[retainedOldKey]?.outbox.entries).toHaveLength(1);
    await expect(store.discardAllOtherOwnerOutboxes(ownerB, true)).resolves.toEqual({ ok: true });

    expect(stored.partitions[currentKey]?.outbox.entries).toHaveLength(1);
    expect(stored.partitions[retainedOldKey]).toMatchObject({
      cache: { retained: true },
      outbox: { entries: [] },
    });
    expect(stored.partitions).not.toHaveProperty(removableOldKey);
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
      schemaVersion: 3 as const,
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

  it("serializes concurrent adapters over the one shared WXT root boundary", async () => {
    let stored = createWatchHistoryStorageRoot();
    let reads = 0;
    let releaseReads: (() => void) | undefined;
    const delayedRead = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });
    setTimeout(() => releaseReads?.(), 0);
    const item = {
      getValue: async () => {
        const snapshot = stored;
        reads += 1;
        if (reads <= 2) await delayedRead;
        return snapshot;
      },
      setValue: async (value: WatchHistoryStorageRoot) => {
        stored = value;
      },
    };
    const first = createWatchHistoryStorage({ item, getBytesInUse: async () => 0, quotaBytes: 1_000_000 });
    const second = createWatchHistoryStorage({ item, getBytesInUse: async () => 0, quotaBytes: 1_000_000 });

    await Promise.all([
      first.updateRoot((root) => ({ ...root, partitions: { ...root.partitions, first: {} as never } })),
      second.updateRoot((root) => ({ ...root, partitions: { ...root.partitions, second: {} as never } })),
    ]);

    expect(stored.partitions).toHaveProperty("first");
    expect(stored.partitions).toHaveProperty("second");
  });

  it("discarding old-owner work retains that partition's rebuildable state", async () => {
    const partitionKey = watchHistoryPartitionKey(ownerA, 1);
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 3,
      partitions: {
        [partitionKey]: {
          ownerUserId: ownerA,
          accountGeneration: 1,
          cache: { retained: true } as never,
          preferences: { youtubeHistoryEnabled: true },
          currentObservation: { clientEventId: "current" } as never,
          outbox: {
            ownerUserId: ownerA,
            accountGeneration: 1,
            entries: [{ event: {} as never, key: "old", slot: "latest", persistedAt: 1 }],
          },
        },
      },
    };
    const store = createWatchHistoryStorage({
      item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
      getBytesInUse: async () => 0,
      quotaBytes: 1_000_000,
    });

    await expect(store.discardOtherOwnerOutbox(ownerB, ownerA, true)).resolves.toEqual({ ok: true });
    expect(stored.partitions[partitionKey]).toMatchObject({
      cache: { retained: true },
      preferences: { youtubeHistoryEnabled: true },
      currentObservation: { clientEventId: "current" },
      outbox: { entries: [] },
    });
  });
});
