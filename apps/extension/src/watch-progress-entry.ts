import { getCrunchyrollProgressEntry } from "./crunchyroll-progress";
import type { VideoAdapter } from "./video-adapter";
import type { WatchProgressEntry } from "./watch-progress";

interface WatchProgressEntryInput {
  adapter: VideoAdapter;
  roomId?: string;
  watchedWithCount: number;
}

export function getWatchProgressEntryForAdapter(
  input: WatchProgressEntryInput,
): WatchProgressEntry | null {
  if (input.adapter.id === "crunchyroll") {
    return getCrunchyrollProgressEntry({
      title: input.adapter.getTitle(),
      video: input.adapter.video,
      roomId: input.roomId,
      watchedWithCount: input.watchedWithCount,
    });
  }

  if (input.adapter.id === "youtube") {
    return getYouTubeProgressEntry(input);
  }

  return null;
}

function getYouTubeProgressEntry(input: WatchProgressEntryInput): WatchProgressEntry | null {
  if (!location.hostname.endsWith("youtube.com") && location.hostname !== "youtu.be") {
    return null;
  }

  const videoId = getYouTubeVideoIdFromLocation();
  const title = input.adapter.getTitle() ?? document.title?.trim() ?? "YouTube video";
  const duration = Number.isFinite(input.adapter.video.duration)
    ? input.adapter.video.duration
    : 0;
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
    currentTime: input.adapter.video.currentTime || 0,
    duration,
    roomId: input.roomId,
    watchedWithCount: input.watchedWithCount,
  };
}

function getYouTubeVideoIdFromLocation(): string | null {
  try {
    const url = new URL(location.href);
    if (url.hostname === "youtu.be") {
      return cleanVideoId(url.pathname.split("/").filter(Boolean)[0]);
    }
    return cleanVideoId(url.searchParams.get("v"));
  } catch {
    return null;
  }
}

function cleanVideoId(value: string | null | undefined): string | null {
  if (!value) return null;
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
