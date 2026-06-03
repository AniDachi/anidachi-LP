import { ChevronRight } from "lucide-react";
import type { WatchProgressEntry } from "./watch-progress";
import {
  formatProgressClock,
  getStoredItemForEntry,
  RESOURCE_PROVIDER_LABELS,
  type StoredWatchItem,
  type WatchProgressStore,
} from "./watch-progress";

interface CurrentResourcePanelProps {
  entry: WatchProgressEntry | null;
  store: WatchProgressStore;
}

export function CurrentResourcePanel({ entry, store }: CurrentResourcePanelProps) {
  if (!entry) {
    return null;
  }

  const storedItem = getStoredItemForEntry(store, entry);
  const progress = getEntryProgress(entry, storedItem);
  const label = RESOURCE_PROVIDER_LABELS[entry.provider];
  const progressText = `${formatProgressClock(entry.currentTime)} / ${formatProgressClock(
    entry.duration,
  )}`;

  return (
    <>
      <div className="section-title">Current resource</div>
      <div className="current-resource-card">
        <div className="current-resource-topline">
          <span className={`resource-provider-dot ${entry.provider}`} />
          <span>{label}</span>
          <ChevronRight size={12} />
          <span className="current-resource-time">{progressText}</span>
        </div>
        <div className="current-resource-title">{entry.itemTitle}</div>
        {entry.kind === "episode" && entry.episodeTitle ? (
          <div className="current-resource-episode">{entry.episodeTitle}</div>
        ) : null}
        <ProgressBar progress={progress} />
      </div>
    </>
  );
}

export function ProgressBar({ progress }: { progress: number }) {
  return (
    <span className="resource-progress">
      <span style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }} />
    </span>
  );
}

function getEntryProgress(entry: WatchProgressEntry, storedItem: StoredWatchItem | null): number {
  if (entry.duration > 0) {
    return Math.max(0, Math.min(1, entry.currentTime / entry.duration));
  }

  return storedItem?.progress ?? 0;
}
