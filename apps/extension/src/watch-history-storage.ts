import type {
  WatchHistoryPreferences,
  WatchHistoryResponse,
  WatchProgressEvent,
} from "@anidachi/protocol";
import { storage } from "wxt/utils/storage";
import type { WatchHistoryOutboxPartition } from "./watch-history-outbox";

export const WATCH_HISTORY_STORAGE_VERSION = 2 as const;
export const WATCH_HISTORY_STORAGE_KEY = "anidachi.watchHistory.v2";
export const WATCH_HISTORY_STORAGE_ITEM_KEY = `local:${WATCH_HISTORY_STORAGE_KEY}` as const;

export type WatchHistoryAccountPartition = {
  ownerUserId: string;
  accountGeneration: number;
  cache: WatchHistoryResponse | null;
  preferences: WatchHistoryPreferences | null;
  currentObservation: WatchProgressEvent | null;
  outbox: WatchHistoryOutboxPartition;
};

export type WatchHistoryStorageRoot = {
  schemaVersion: typeof WATCH_HISTORY_STORAGE_VERSION;
  partitions: Record<string, WatchHistoryAccountPartition>;
};

export type WatchHistoryStorageResult = { ok: true } | { ok: false; status: "storage-full" };

type StorageItemLike = {
  getValue(): Promise<WatchHistoryStorageRoot | null>;
  setValue(value: WatchHistoryStorageRoot): Promise<void>;
};

export type WatchHistoryStorageDependencies = {
  item?: StorageItemLike;
  getBytesInUse?: () => Promise<number>;
  quotaBytes?: number;
  serialize?: (value: WatchHistoryStorageRoot) => string;
};

let watchHistoryStorageItem: StorageItemLike | null = null;

export function createWatchHistoryStorageRoot(): WatchHistoryStorageRoot {
  return { schemaVersion: WATCH_HISTORY_STORAGE_VERSION, partitions: {} };
}

export function watchHistoryPartitionKey(ownerUserId: string, accountGeneration: number): string {
  return `${encodeURIComponent(ownerUserId)}:${accountGeneration}`;
}

export function createWatchHistoryStorage(
  dependencies: WatchHistoryStorageDependencies = {},
) {
  const item = dependencies.item ?? getDefaultStorageItem();
  const getBytesInUse = dependencies.getBytesInUse ?? defaultGetBytesInUse;
  const quotaBytes = dependencies.quotaBytes ?? defaultQuotaBytes();
  const serialize = dependencies.serialize ?? JSON.stringify;
  let updateQueue = Promise.resolve();

  async function readRoot(): Promise<WatchHistoryStorageRoot> {
    const stored = await item.getValue();
    return isStorageRoot(stored) ? stored : createWatchHistoryStorageRoot();
  }

  async function replaceRoot(candidate: WatchHistoryStorageRoot): Promise<WatchHistoryStorageResult> {
    if (!isStorageRoot(candidate)) throw new Error("Invalid watch history storage root");
    const existing = await readRoot();
    let usedBytes = 0;
    try {
      usedBytes = await getBytesInUse();
    } catch {
      // A quota estimate is best effort. The write itself remains authoritative.
    }
    const candidateBytes = new TextEncoder().encode(serialize(candidate)).byteLength;
    const existingBytes = new TextEncoder().encode(serialize(existing)).byteLength;
    const projectedBytes = Math.max(0, usedBytes - existingBytes) + candidateBytes;
    if (Number.isFinite(quotaBytes) && projectedBytes > quotaBytes) {
      return { ok: false, status: "storage-full" };
    }
    try {
      await item.setValue(candidate);
      return { ok: true };
    } catch {
      return { ok: false, status: "storage-full" };
    }
  }

  async function updateRoot(
    update: (root: WatchHistoryStorageRoot) => WatchHistoryStorageRoot,
  ): Promise<WatchHistoryStorageResult> {
    const operation: Promise<WatchHistoryStorageResult> = updateQueue.then(async () => {
      const root = await readRoot();
      const candidate = update(root);
      return candidate === root ? ({ ok: true } as const) : replaceRoot(candidate);
    });
    updateQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async function clearRebuildableAccountData(ownerUserId: string): Promise<WatchHistoryStorageResult> {
    return updateRoot((root) => {
      let changed = false;
      const partitions = Object.fromEntries(
        Object.entries(root.partitions).flatMap(([key, partition]) => {
          if (partition.ownerUserId !== ownerUserId) return [[key, partition]];
          changed = true;
          const cleared = { ...partition, cache: null, preferences: null, currentObservation: null };
          return cleared.outbox.entries.length === 0 ? [] : [[key, cleared]];
        }),
      );
      if (!changed) return root;
      return {
        ...root,
        partitions,
      };
    });
  }

  async function discardOtherOwnerOutbox(
    currentOwnerUserId: string,
    oldOwnerUserId: string,
    confirmed: boolean,
  ): Promise<WatchHistoryStorageResult> {
    if (!confirmed) throw new Error("Discarding pending watch history requires confirmation");
    if (currentOwnerUserId === oldOwnerUserId) {
      throw new Error("The current account outbox cannot be discarded as old-owner work");
    }
    return updateRoot((root) => {
      const remaining = Object.fromEntries(
        Object.entries(root.partitions).flatMap(([key, partition]) => {
          if (partition.ownerUserId !== oldOwnerUserId) return [[key, partition]];
          const cleared = { ...partition, outbox: { ...partition.outbox, entries: [] } };
          return cleared.cache || cleared.preferences || cleared.currentObservation ? [[key, cleared]] : [];
        }),
      );
      if (Object.keys(remaining).length === Object.keys(root.partitions).length) return root;
      return { ...root, partitions: remaining };
    });
  }

  async function otherOwnerPendingSummary(currentOwnerUserId: string): Promise<{
    hasPendingWork: boolean;
    byteUse: number;
  }> {
    const root = await readRoot();
    const pending = Object.entries(root.partitions).filter(([, partition]) =>
      partition.ownerUserId !== currentOwnerUserId && partition.outbox.entries.length > 0,
    );
    return {
      hasPendingWork: pending.length > 0,
      byteUse: new TextEncoder().encode(serialize({ ...root, partitions: Object.fromEntries(
        pending,
      ) })).byteLength,
    };
  }

  return {
    readRoot,
    replaceRoot,
    updateRoot,
    clearRebuildableAccountData,
    discardOtherOwnerOutbox,
    otherOwnerPendingSummary,
  };
}

function getDefaultStorageItem(): StorageItemLike {
  if (watchHistoryStorageItem) return watchHistoryStorageItem;
  watchHistoryStorageItem = storage.defineItem<WatchHistoryStorageRoot>(
    WATCH_HISTORY_STORAGE_ITEM_KEY,
    { fallback: createWatchHistoryStorageRoot(), version: WATCH_HISTORY_STORAGE_VERSION },
  );
  return watchHistoryStorageItem;
}

async function defaultGetBytesInUse(): Promise<number> {
  const storageArea = chrome.storage?.local;
  if (!storageArea?.getBytesInUse) return 0;
  return storageArea.getBytesInUse(null);
}

function defaultQuotaBytes(): number {
  return chrome.storage?.local?.QUOTA_BYTES ?? Number.POSITIVE_INFINITY;
}

function isStorageRoot(value: unknown): value is WatchHistoryStorageRoot {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { schemaVersion?: unknown }).schemaVersion === WATCH_HISTORY_STORAGE_VERSION &&
    typeof (value as { partitions?: unknown }).partitions === "object" &&
    (value as { partitions?: unknown }).partitions !== null
  );
}
