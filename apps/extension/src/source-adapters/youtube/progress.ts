import {
  isValidHistoryMedia,
  normalizeHistoryUrl,
  type HistoryObservation,
  type ProviderPlaybackMetadata,
  type SourceAdapterHistoryPolicy,
} from "../core/history-policy";
import type { VideoAdapter } from "../core/types";

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
}): HistoryObservation | null {
  const { adapter, preferences } = input;
  if (!preferences?.youtubeHistoryEnabled || adapter.id !== "youtube" || adapter.provider !== "youtube") {
    return null;
  }
  if (!isValidHistoryMedia(adapter.video)) return null;
  const sourceUrl = canonicalYouTubeHistoryUrl(location.href);
  if (!sourceUrl) return null;
  const videoId = new URL(sourceUrl).searchParams.get("v");
  if (!videoId || !cleanYouTubeProgressVideoId(videoId)) return null;
  const title = adapter.getTitle()?.trim();
  if (!title) return null;
  const key = `youtube:${videoId}`;
  return {
    provider: "youtube",
    providerLabel: "YouTube",
    titleKey: key,
    itemKind: "movie",
    title,
    artworkUrl: null,
    episodeKey: key,
    episodeTitle: title,
    seasonKey: null,
    seasonTitle: null,
    seasonNumber: null,
    episodeNumber: null,
    sourceUrl,
    currentTime: adapter.video.currentTime,
    duration: adapter.video.duration,
    progress: adapter.video.currentTime / adapter.video.duration,
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
  const origin = url.hostname === "m.youtube.com"
    ? "https://www.youtube.com"
    : url.origin;
  return `${origin}/watch?v=${encodeURIComponent(videoId)}`;
}

function isSupportedYouTubeHost(hostname: string): boolean {
  return hostname === "youtube.com" || hostname === "www.youtube.com" || hostname === "m.youtube.com";
}
