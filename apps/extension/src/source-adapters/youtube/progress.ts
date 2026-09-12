import {
  HISTORY_OBSERVATION_SUSPENDED,
  type HistoryObservationResult,
  isValidHistoryMedia,
  normalizeHistoryUrl,
  type ProviderPlaybackMetadata,
  type SourceAdapterHistoryPolicy,
} from "../core/history-policy";
import type { VideoAdapter } from "../core/types";
import { youtubeHistoryArtworkUrl } from "./artwork";

export interface YouTubeProgressInput {
  title: string | null;
  video: HTMLVideoElement;
  roomId?: string;
  watchedWithCount: number;
}

export function getYouTubeProgressEntry(input: YouTubeProgressInput): ProviderPlaybackMetadata | null {
  if (!location.hostname.endsWith("youtube.com") && location.hostname !== "youtu.be") {
    return null;
  }

  const videoId = getYouTubeProgressVideoId();
  const title = input.title ?? document.title?.trim() ?? "YouTube video";
  const duration = Number.isFinite(input.video.duration) ? input.video.duration : 0;
  const sourceUrl = canonicalSourceUrl();

  if (!videoId || !sourceUrl || !title.trim()) {
    return null;
  }

  return {
    provider: "youtube",
    kind: "movie",
    itemId: `youtube:${videoId}`,
    itemTitle: title.trim(),
    contentId: videoId,
    sourceUrl,
    currentTime: input.video.currentTime || 0,
    duration,
    roomId: input.roomId,
    watchedWithCount: input.watchedWithCount,
  };
}

export const youtubeHistoryPolicy: SourceAdapterHistoryPolicy = {
  observe: getYouTubeHistoryObservation,
};

export function getYouTubeHistoryObservation(input: {
  adapter: VideoAdapter;
  preferences: { youtubeHistoryEnabled: boolean } | null;
}): HistoryObservationResult {
  const { adapter, preferences } = input;
  if (!preferences?.youtubeHistoryEnabled || adapter.id !== "youtube" || adapter.provider !== "youtube") {
    return null;
  }
  const playback = adapter.getPlaybackSnapshot();
  if (playback.phase !== "content") return HISTORY_OBSERVATION_SUSPENDED;
  if (!isValidHistoryMedia(adapter.video)) return null;
  if (
    !Number.isFinite(playback.contentTime) ||
    playback.contentTime < 0 ||
    playback.contentTime > adapter.video.duration
  ) return null;
  const sourceUrl = canonicalYouTubeHistoryUrl(location.href);
  if (!sourceUrl) return null;
  const videoId = new URL(sourceUrl).searchParams.get("v");
  if (!videoId || !cleanYouTubeProgressVideoId(videoId)) return null;
  const title = adapter.getTitle()?.trim();
  if (!title) return null;
  const key = `youtube:video:${videoId}`;
  return {
    provider: "youtube",
    providerLabel: "YouTube",
    youtubeVideoId: videoId,
    titleKey: key,
    itemKind: "movie",
    title,
    artworkUrl: youtubeHistoryArtworkUrl(videoId),
    episodeKey: key,
    episodeTitle: title,
    seasonKey: null,
    seasonTitle: null,
    seasonNumber: null,
    episodeNumber: null,
    sourceUrl,
    currentTime: playback.contentTime,
    duration: adapter.video.duration,
    progress: playback.contentTime / adapter.video.duration,
  };
}

function getYouTubeProgressVideoId(): string | null {
  try {
    const url = new URL(location.href);
    if (url.hostname === "youtu.be") {
      return cleanYouTubeProgressVideoId(url.pathname.split("/").filter(Boolean)[0]);
    }

    return cleanYouTubeProgressVideoId(url.searchParams.get("v"));
  } catch {
    return null;
  }
}

function cleanYouTubeProgressVideoId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const cleaned = value.trim();
  return /^[A-Za-z0-9_-]{6,32}$/.test(cleaned) ? cleaned : null;
}

function canonicalSourceUrl(): string | null {
  try {
    const url = new URL(location.href);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function canonicalYouTubeHistoryUrl(value: string): string | null {
  const normalized = normalizeHistoryUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  if (!isSupportedYouTubeHost(url.hostname) || url.pathname !== "/watch") return null;
  const videoId = cleanYouTubeProgressVideoId(url.searchParams.get("v"));
  if (!videoId) return null;
  const origin = "https://www.youtube.com";
  return `${origin}/watch?v=${encodeURIComponent(videoId)}`;
}

function isSupportedYouTubeHost(hostname: string): boolean {
  return hostname === "youtube.com" || hostname === "www.youtube.com" || hostname === "m.youtube.com";
}
