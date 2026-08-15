import { ChevronRight } from "lucide-react";
import type { HistoryObservation } from "./source-adapters/core/history-policy";

interface CurrentResourcePanelProps {
  entry: HistoryObservation | null;
}

export function CurrentResourcePanel({ entry }: CurrentResourcePanelProps) {
  if (!entry) {
    return null;
  }

  const label = entry.provider === "crunchyroll" ? "Crunchyroll" : "YouTube";
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
        <div className="current-resource-title">{entry.title}</div>
        {entry.itemKind === "series" && entry.episodeTitle ? (
          <div className="current-resource-episode">{entry.episodeTitle}</div>
        ) : null}
        <ProgressBar progress={entry.progress} />
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

function formatProgressClock(value: number): string {
  const wholeSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
