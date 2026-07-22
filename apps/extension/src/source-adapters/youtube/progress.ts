import type { WatchProgressEntry } from "../../watch-progress";
import { parseYouTubeVideoId } from "./url";

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
    if (url.hostname !== "youtu.be" && !url.searchParams.has("v")) {
      return null;
    }

    const videoId = parseYouTubeVideoId(url);
    return videoId && videoId.length <= 32 ? videoId : null;
  } catch {
    return null;
  }
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
