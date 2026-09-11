import type { WatchHistoryPreferences } from "@anidachi/protocol";
import type { WatchHistoryLocalEvent } from "../../watch-history-outbox";
import type { VideoAdapter } from "./types";

export type HistoryObservation = {
  identityPending?: WatchHistoryLocalEvent["identityPending"];
  crunchyrollIdentity?: WatchHistoryLocalEvent["crunchyrollIdentity"];
  youtubeVideoId?: string;
  provider: "crunchyroll" | "youtube";
  providerLabel: string;
  titleKey: string;
  itemKind: "movie" | "series";
  title: string;
  artworkUrl: string | null;
  episodeKey: string;
  episodeTitle: string;
  seasonKey: string | null;
  seasonTitle: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  sourceUrl: string;
  currentTime: number;
  duration: number;
  progress: number;
  catalogState?: "unavailable";
};

export const HISTORY_OBSERVATION_SUSPENDED = Symbol("history-observation-suspended");

// The sentinel pauses capture while a provider cannot confirm main content.
// `null` means the supported source is gone and closes the retained session.
export type HistoryObservationResult =
  | HistoryObservation
  | typeof HISTORY_OBSERVATION_SUSPENDED
  | null;

export type ProviderPlaybackMetadata = {
  provider: "crunchyroll" | "youtube";
  kind: "movie" | "episode";
  itemId: string;
  itemTitle: string;
  contentId?: string;
  seriesId?: string;
  seasonId?: string;
  seasonTitle?: string;
  seasonNumber?: number;
  episodeId?: string;
  episodeTitle?: string;
  artworkUrl?: string;
  sourceUrl: string;
  currentTime: number;
  duration: number;
  roomId?: string;
  watchedWithCount: number;
};

export type HistoryPolicyInput = {
  adapter: VideoAdapter;
  preferences: WatchHistoryPreferences | null;
};

export interface SourceAdapterHistoryPolicy {
  observe(input: HistoryPolicyInput): HistoryObservationResult;
}

export function isValidHistoryMedia(video: HTMLVideoElement): boolean {
  return Number.isFinite(video.currentTime) && video.currentTime >= 0 &&
    Number.isFinite(video.duration) && video.duration > 0 &&
    video.currentTime <= video.duration;
}

export function normalizeHistoryUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
