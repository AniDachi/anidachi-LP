import { parseYouTubeVideoId } from "./url";

const WATCH_OWNER = "ytd-watch-flexy, ytd-watch-grid";
export const WATCH_PLAYER = "#movie_player, ytm-player .html5-video-player";
const boundMedia = new WeakMap<HTMLVideoElement, {id: string; src: string}>();

export function changedWatchOwner(record: MutationRecord): boolean {
  return record.attributeName === "video-id" && record.target instanceof Element && record.target.matches(WATCH_OWNER);
}

/** YouTube can reuse both the player and its video element across watch URLs. */
export function matchesWatchMedia(video: HTMLVideoElement, id: string): boolean {
  const last = boundMedia.get(video);
  if (last && last.id !== id && (!video.currentSrc || video.currentSrc === last.src)) return false;
  if (!last) {
    video.addEventListener("loadedmetadata", () => {
      const url = new URL(location.href);
      const loadedId = /^\/watch\/?$/.test(url.pathname) && parseYouTubeVideoId(url);
      if (loadedId) boundMedia.set(video, {id: loadedId, src: video.currentSrc});
    });
  }
  if (!last || last.id !== id || last.src !== video.currentSrc)
    boundMedia.set(video, {id, src: video.currentSrc});
  return true;
}

export function matchesWatchPlayer(player: HTMLElement, videoId: string | null): boolean {
  if (!videoId || !player.matches(WATCH_PLAYER) ||
      player.closest("ytd-miniplayer, .ytp-player-minimized, ytd-video-preview, #inline-preview-player")) return false;
  const owner = player.closest(WATCH_OWNER);
  if (owner) return owner.getAttribute("video-id") === videoId;
  // Mobile and standalone watch layouts have no desktop watch owner.
  return !player.ownerDocument.querySelector(WATCH_OWNER);
}
