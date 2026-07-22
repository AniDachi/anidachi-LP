import type { SourceAdapterDefinition } from "../core/types";
import { YouTubeVideoAdapter } from "./adapter";

export const youtubeDefinition: SourceAdapterDefinition = {
  id: "youtube",
  provider: "youtube",
  priority: 300,
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
