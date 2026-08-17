import type { WatchHistoryController } from "./watch-history-controller";
import { WATCH_HISTORY_STORAGE_KEY, watchHistoryPartitionKey } from "./watch-history-storage";

type StorageChange = { oldValue?: unknown; newValue?: unknown };
type StorageChangeListener = (
  changes: Record<string, StorageChange>,
  areaName: string,
) => void;

type StorageChangedEventLike = {
  addListener(listener: StorageChangeListener): void;
  removeListener(listener: StorageChangeListener): void;
};

export function bindWatchHistoryPreferenceListener(options: {
  ownerUserId: string;
  controller: Pick<WatchHistoryController, "observe" | "refreshAuthority">;
  onChanged?: StorageChangedEventLike;
}): () => void {
  const onChanged = options.onChanged ?? chrome.storage.onChanged;
  const listener: StorageChangeListener = (changes, areaName) => {
    if (areaName !== "local") return;
    const change = changes[WATCH_HISTORY_STORAGE_KEY];
    if (!change) return;
    const previous = preferenceSignature(change.oldValue, options.ownerUserId);
    const next = preferenceSignature(change.newValue, options.ownerUserId);
    if (previous === next) return;
    void options.controller.refreshAuthority()
      .then(() => options.controller.observe("heartbeat"))
      .catch(() => undefined);
  };
  onChanged.addListener(listener);
  return () => onChanged.removeListener(listener);
}

function preferenceSignature(value: unknown, ownerUserId: string): string | null {
  if (!isRecord(value) || value.schemaVersion !== 2 || !isRecord(value.activeGenerations) ||
    !isRecord(value.partitions)) {
    return null;
  }
  const generation = value.activeGenerations[ownerUserId];
  if (typeof generation !== "number" || !Number.isSafeInteger(generation) || generation < 0) {
    return null;
  }
  const partition = value.partitions[watchHistoryPartitionKey(ownerUserId, generation)];
  if (!isRecord(partition) || partition.ownerUserId !== ownerUserId ||
    partition.accountGeneration !== generation || partition.preferencesConfirmed !== true ||
    !isRecord(partition.preferences) ||
    typeof partition.preferences.youtubeHistoryEnabled !== "boolean") {
    return null;
  }
  const revision = partition.preferencesLocalRevision;
  const localRevision = typeof revision === "number" && Number.isSafeInteger(revision) && revision >= 0
    ? revision
    : 0;
  return `${generation}:${localRevision}:${partition.preferences.youtubeHistoryEnabled}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
