import type { WatchProgressEntry } from "../../watch-progress";

export interface YouTubeProgressInput {
  title: string | null;
  video: HTMLVideoElement;
  roomId?: string;
  watchedWithCount: number;
}

export function getYouTubeProgressEntry(input: YouTubeProgressInput): WatchProgressEntry | null {
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
