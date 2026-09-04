import {
  WatchHistoryPreferencesSchema,
  type WatchHistoryPreferences,
  type WatchHistoryResponse,
  type WatchProgressEvent,
} from "@anidachi/protocol";
import { storage } from "wxt/utils/storage";
import type { WatchHistoryOutboxPartition } from "./watch-history-outbox";
import type { WatchHistoryCatalogAcknowledgement } from "./watch-history-catalog";

export const WATCH_HISTORY_STORAGE_VERSION = 3 as const;
export const WATCH_HISTORY_STORAGE_KEY = "anidachi.watchHistory.v3";
export const WATCH_HISTORY_STORAGE_ITEM_KEY = `local:${WATCH_HISTORY_STORAGE_KEY}` as const;

export type WatchHistoryObservationDisplayMode = "mine" | "together";

export type WatchHistoryAccountPartition = {
  ownerUserId: string;
  accountGeneration: number;
  cache: WatchHistoryResponse | null;
  preferences: WatchHistoryPreferences | null;
  preferencesConfirmed?: boolean;
  preferencesSyncPending?: boolean;
  preferencesLocalRevision?: number;
  currentObservation: WatchProgressEvent | null;
  currentObservationMeaningfulSolo?: boolean;
  currentObservationDisplayMode?: WatchHistoryObservationDisplayMode | null;
  capturePaused?: boolean;
  captureMarkersReady?: boolean;
  outbox: WatchHistoryOutboxPartition;
  catalogAcknowledgements?: Record<string, WatchHistoryCatalogAcknowledgement>;
  invalidationRevision?: number;
  cacheRevision?: number;
  deletionFences?: Record<string, string>;
};

export type WatchHistoryStorageRoot = {
  schemaVersion: typeof WATCH_HISTORY_STORAGE_VERSION;
  partitions: Record<string, WatchHistoryAccountPartition>;
  activeGenerations?: Record<string, number>;
};

export type WatchHistoryStorageResult = { ok: true } | { ok: false; status: "storage-full" };

type StorageItemLike = {
  getValue(): Promise<WatchHistoryStorageRoot | null>;
  setValue(value: WatchHistoryStorageRoot): Promise<void>;
};

export type WatchHistoryStorageDependencies = {
  item?: StorageItemLike;
  hasStoredRoot?: () => Promise<boolean>;
  getBytesInUse?: () => Promise<number>;
  quotaBytes?: number;
  serialize?: (value: WatchHistoryStorageRoot) => string;
  readLegacy?: () => Promise<unknown>;
  removeLegacy?: () => Promise<void>;
};

let watchHistoryStorageItem: StorageItemLike | null = null;
let rootUpdateQueue: Promise<void> = Promise.resolve();

export function createWatchHistoryStorageRoot(): WatchHistoryStorageRoot {
  return { schemaVersion: WATCH_HISTORY_STORAGE_VERSION, partitions: {}, activeGenerations: {} };
}

export function watchHistoryPartitionKey(ownerUserId: string, accountGeneration: number): string {
  return `${encodeURIComponent(ownerUserId)}:${accountGeneration}`;
}

export function createWatchHistoryStorage(
  dependencies: WatchHistoryStorageDependencies = {},
) {
  const item = dependencies.item ?? getDefaultStorageItem();
  const hasStoredRoot = dependencies.hasStoredRoot ?? (dependencies.item
    ? async () => true
    : defaultHasStoredRoot);
  const getBytesInUse = dependencies.getBytesInUse ?? defaultGetBytesInUse;
  const quotaBytes = dependencies.quotaBytes ?? defaultQuotaBytes();
  const serialize = dependencies.serialize ?? JSON.stringify;
  let migration: Promise<void> | undefined;

  function ensureMigration(): Promise<void> {
    if (migration) return migration;
    migration = rootUpdateQueue.then(async () => {
      const stored = await item.getValue();
      if (isStorageRoot(stored) && (dependencies.item || await hasStoredRoot())) return;
      const legacy = dependencies.readLegacy
        ? await dependencies.readLegacy()
        : dependencies.item ? null : (await chrome.storage.local.get("anidachi.watchHistory.v2"))["anidachi.watchHistory.v2"];
      if (!legacy) return;
      const migrated = migrateLegacyPreferences(legacy);
      const result = await replaceRoot(migrated);
      if (!result.ok) throw new Error("Watch history upgrade could not persist preferences");
      if (dependencies.removeLegacy) await dependencies.removeLegacy();
      else if (!dependencies.item) await chrome.storage.local.remove("anidachi.watchHistory.v2");
    });
    rootUpdateQueue = migration.catch(() => undefined);
    return migration;
  }

  async function readRoot(): Promise<WatchHistoryStorageRoot> {
    await ensureMigration();
    const stored = await item.getValue();
    return normalizeStorageRoot(stored);
  }

  async function replaceRoot(candidate: WatchHistoryStorageRoot): Promise<WatchHistoryStorageResult> {
    if (!isStorageRoot(candidate)) throw new Error("Invalid watch history storage root");
    const storedValue = await item.getValue();
    const hasStoredValue = await hasStoredRoot();
    let usedBytes = 0;
    try {
      usedBytes = await getBytesInUse();
    } catch {
      // A quota estimate is best effort. The write itself remains authoritative.
    }
    const candidateBytes = new TextEncoder().encode(serialize(candidate)).byteLength;
    const keyBytes = new TextEncoder().encode(WATCH_HISTORY_STORAGE_KEY).byteLength;
    const existingBytes = hasStoredValue && isStorageRoot(storedValue)
      ? new TextEncoder().encode(serialize(storedValue)).byteLength + keyBytes
      : 0;
    const totalCandidateBytes = candidateBytes + keyBytes;
    const projectedBytes = Math.max(0, usedBytes - existingBytes) + totalCandidateBytes;
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
    await ensureMigration();
    const operation: Promise<WatchHistoryStorageResult> = rootUpdateQueue.then(async () => {
      const root = normalizeStorageRoot(await item.getValue());
      const candidate = update(root);
      return candidate === root ? ({ ok: true } as const) : replaceRoot(candidate);
    });
    rootUpdateQueue = operation.then(
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
          const cleared = {
            ...partition,
            cache: null,
            preferences: null,
            preferencesConfirmed: false,
            preferencesSyncPending: false,
            preferencesLocalRevision: 0,
            currentObservation: null,
            currentObservationMeaningfulSolo: false,
            currentObservationDisplayMode: null,
            catalogAcknowledgements: {},
          };
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
      let changed = false;
      const remaining = Object.fromEntries(
        Object.entries(root.partitions).flatMap(([key, partition]) => {
          if (partition.ownerUserId !== oldOwnerUserId) return [[key, partition]];
          if (partition.outbox.entries.length === 0) return [[key, partition]];
          changed = true;
          const cleared = { ...partition, outbox: { ...partition.outbox, entries: [] } };
          return cleared.cache || cleared.preferences || cleared.currentObservation ? [[key, cleared]] : [];
        }),
      );
      if (!changed) return root;
      return { ...root, partitions: remaining };
    });
  }

  async function discardAllOtherOwnerOutboxes(
    currentOwnerUserId: string,
    confirmed: boolean,
  ): Promise<WatchHistoryStorageResult> {
    if (!confirmed) throw new Error("Discarding pending watch history requires confirmation");
    return updateRoot((root) => {
      let changed = false;
      const partitions = Object.fromEntries(
        Object.entries(root.partitions).flatMap(([key, partition]) => {
          if (partition.ownerUserId === currentOwnerUserId || partition.outbox.entries.length === 0) {
            return [[key, partition]];
          }
          changed = true;
          const cleared = { ...partition, outbox: { ...partition.outbox, entries: [] } };
          return cleared.cache || cleared.preferences || cleared.currentObservation ? [[key, cleared]] : [];
        }),
      );
      return changed ? { ...root, partitions } : root;
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
    discardAllOtherOwnerOutboxes,
    otherOwnerPendingSummary,
  };
}

function migrateLegacyPreferences(value: unknown): WatchHistoryStorageRoot {
  const root = createWatchHistoryStorageRoot();
  if (!value || typeof value !== "object" || !("schemaVersion" in value) || value.schemaVersion !== 2 ||
    !("partitions" in value) || !value.partitions || typeof value.partitions !== "object") return root;
  for (const [key, candidate] of Object.entries(value.partitions)) {
    if (!candidate || typeof candidate !== "object") continue;
    const { ownerUserId, accountGeneration } = candidate;
    if (typeof ownerUserId !== "string" || !ownerUserId || ownerUserId.length > 128 ||
      !Number.isSafeInteger(accountGeneration) || accountGeneration < 1 ||
      key !== watchHistoryPartitionKey(ownerUserId, accountGeneration)) continue;
    const preferences = WatchHistoryPreferencesSchema.safeParse(candidate.preferences);
    if (!preferences.success || candidate.preferencesConfirmed !== true) continue;
    root.partitions[key] = {
      ownerUserId, accountGeneration, cache: null, currentObservation: null,
      preferences: preferences.data, preferencesConfirmed: true,
      preferencesSyncPending: candidate.preferencesSyncPending === true,
      preferencesLocalRevision: normalizeLocalRevision(candidate.preferencesLocalRevision),
      capturePaused: true, captureMarkersReady: true,
      outbox: { ownerUserId, accountGeneration, entries: [] },
    };
    root.activeGenerations![ownerUserId] = Math.max(root.activeGenerations![ownerUserId] ?? 0, accountGeneration);
  }
  return root;
}

export function withoutWatchHistoryAttestation(event: WatchProgressEvent): WatchProgressEvent {
  const { sharedRoom: _sharedRoom, ...safeObservation } = event;
  return safeObservation;
}

function activeGenerationsFromPartitions(
  partitions: Record<string, WatchHistoryAccountPartition>,
): Record<string, number> {
  return Object.values(partitions).reduce<Record<string, number>>((active, partition) => ({
    ...active,
    [partition.ownerUserId]: Math.max(active[partition.ownerUserId] ?? 0, partition.accountGeneration),
  }), {});
}

function normalizeStorageRoot(value: unknown): WatchHistoryStorageRoot {
  return isStorageRoot(value)
    ? {
        ...value,
        partitions: Object.fromEntries(Object.entries(value.partitions).map(([key, partition]) => [
          key,
          normalizePartition(partition),
        ])),
        activeGenerations: value.activeGenerations ?? activeGenerationsFromPartitions(value.partitions),
      }
    : createWatchHistoryStorageRoot();
}

function normalizePartition(partition: WatchHistoryAccountPartition): WatchHistoryAccountPartition {
  const captureMarkersReady = partition.captureMarkersReady === true &&
    typeof partition.capturePaused === "boolean" &&
    typeof partition.preferencesConfirmed === "boolean";
  if (!captureMarkersReady) {
    return {
      ...partition,
      preferencesConfirmed: false,
      preferencesSyncPending: partition.preferencesSyncPending === true,
      preferencesLocalRevision: normalizeLocalRevision(partition.preferencesLocalRevision),
      capturePaused: true,
      captureMarkersReady: false,
      currentObservationMeaningfulSolo: false,
      currentObservationDisplayMode: null,
    };
  }
  return {
    ...partition,
    preferencesConfirmed: partition.preferencesConfirmed === true,
    preferencesSyncPending: partition.preferencesSyncPending === true,
    preferencesLocalRevision: normalizeLocalRevision(partition.preferencesLocalRevision),
    capturePaused: partition.capturePaused === true,
    captureMarkersReady: true,
    currentObservationMeaningfulSolo: partition.currentObservation !== null &&
      partition.currentObservationMeaningfulSolo === true,
    currentObservationDisplayMode: partition.currentObservation === null
      ? null
      : partition.currentObservationDisplayMode === "mine" ||
          partition.currentObservationDisplayMode === "together"
        ? partition.currentObservationDisplayMode
        : partition.currentObservationDisplayMode === undefined &&
            partition.currentObservationMeaningfulSolo === true
          ? "mine"
          : null,
  };
}

function normalizeLocalRevision(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
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

async function defaultHasStoredRoot(): Promise<boolean> {
  if (typeof chrome === "undefined") return false;
  const storageArea = chrome.storage?.local;
  if (!storageArea) return false;
  const values = await storageArea.get(WATCH_HISTORY_STORAGE_KEY);
  return Object.prototype.hasOwnProperty.call(values, WATCH_HISTORY_STORAGE_KEY);
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
