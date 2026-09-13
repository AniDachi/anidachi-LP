import { parseWatchHistoryLease, type WatchHistoryLease } from "./watch-history-access";
import type { WatchHistoryController } from "./watch-history-controller";
import { hasHistoryRecordingConsent, historyRecordingChoiceKey } from "./history-recording-choice";
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
  controller: Pick<WatchHistoryController, "applyLocalPreferences"> & Partial<Pick<WatchHistoryController, "refreshAuthority" | "invalidateCaptureAuthority">>;
  hasRecordingConsent?: (owner: string) => Promise<boolean>;
  onChanged?: StorageChangedEventLike;
}): () => void {
  const onChanged = options.onChanged ?? chrome.storage.onChanged;
  const consent = options.hasRecordingConsent ?? hasHistoryRecordingConsent;
  let revision = 0;
  let disposed = false;
  const listener: StorageChangeListener = (changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[historyRecordingChoiceKey(options.ownerUserId)]) {
      ++revision;
      options.controller.invalidateCaptureAuthority?.();
      void options.controller.refreshAuthority?.().catch(() => undefined);
    }
    const change = changes[WATCH_HISTORY_STORAGE_KEY];
    if (!change) return;
    const previous = localPreferenceAuthority(change.oldValue, options.ownerUserId);
    const next = localPreferenceAuthority(change.newValue, options.ownerUserId);
    if (!next || preferenceSignature(previous) === preferenceSignature(next)) return;
    const request = ++revision;
    void (async () => {
      const allowed = await consent(options.ownerUserId).catch(() => false);
      if (disposed || request !== revision) return;
      await options.controller.applyLocalPreferences({
        ownerUserId: next.ownerUserId,
        accountGeneration: next.accountGeneration,
        preferences: next.preferences,
        accessLease: allowed ? next.accessLease : null,
        capturePaused: next.capturePaused,
      });
    })().catch(() => undefined);
  };
  onChanged.addListener(listener);
  return () => { disposed = true; ++revision; onChanged.removeListener(listener); };
}

type LocalPreferenceAuthority = {
  ownerUserId: string;
  accountGeneration: number;
  preferences: { youtubeHistoryEnabled: boolean };
  accessLease: WatchHistoryLease | null;
  localRevision: number;
  capturePaused: boolean;
};

function localPreferenceAuthority(
  value: unknown,
  ownerUserId: string,
): LocalPreferenceAuthority | null {
  if (!isRecord(value) || value.schemaVersion !== 3 || !isRecord(value.activeGenerations) ||
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
    partition.captureMarkersReady !== true || typeof partition.capturePaused !== "boolean" ||
    !isRecord(partition.preferences) ||
    typeof partition.preferences.youtubeHistoryEnabled !== "boolean") {
    return null;
  }
  const revision = partition.preferencesLocalRevision;
  const localRevision = typeof revision === "number" && Number.isSafeInteger(revision) && revision >= 0
    ? revision
    : 0;
  return {
    ownerUserId,
    accountGeneration: generation,
    preferences: { youtubeHistoryEnabled: partition.preferences.youtubeHistoryEnabled && partition.preferencesSyncPending !== true },
    accessLease: parseWatchHistoryLease(partition.accessLease),
    localRevision,
    capturePaused: partition.capturePaused,
  };
}

function preferenceSignature(authority: LocalPreferenceAuthority | null): string | null {
  return authority
    ? JSON.stringify([authority.accountGeneration, authority.localRevision, authority.preferences.youtubeHistoryEnabled, authority.capturePaused, authority.accessLease?.access, authority.accessLease?.expiresAt])
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
