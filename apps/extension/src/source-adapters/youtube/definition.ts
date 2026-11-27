import type { SourceAdapterDefinition } from "../core/types";
import { YouTubeVideoAdapter } from "./adapter";
import { ensureYouTubeSource } from "./navigation";
import { youtubeHistoryPolicy } from "./progress";
import { isUsableVideo } from "../core/video-discovery";
import { matchesWatchMedia, matchesWatchPlayer, WATCH_PLAYER } from "./watch-player";

export function detectYouTubeWatchAdapter(root: Document, videoId: string | null) {
  for (const player of root.querySelectorAll<HTMLElement>(WATCH_PLAYER)) {
    if (!matchesWatchPlayer(player, videoId)) continue;
    for (const video of player.querySelectorAll("video")) {
      if (videoId && video.closest("#movie_player, .html5-video-player") === player &&
          isUsableVideo(video) && matchesWatchMedia(video, videoId))
        return new YouTubeVideoAdapter(video, player);
    }
  }
  return null;
}

export const youtubeDefinition: SourceAdapterDefinition = {
  id: "youtube",
  provider: "youtube",
  priority: 300,
  historyPolicy: youtubeHistoryPolicy,
  ensureSource: ensureYouTubeSource,
  detect(video) {
    const container = findYouTubePlayerContainer(video);
    return container ? new YouTubeVideoAdapter(video, container) : null;
  },
};

function findYouTubePlayerContainer(video: HTMLVideoElement): HTMLElement | null {
  const player = video.closest<HTMLElement>("#movie_player, .html5-video-player");
  if (player) {
    return player;
  }

  const fallback = document.querySelector<HTMLElement>("#movie_player, .html5-video-player");
  return fallback?.contains(video) ? fallback : null;
}
