import { isVisibleInPlayer } from "./player-chrome";

const mainVideo = '[data-testid="playerContainer"] > video[data-testid="VideoElement"]';

export function hboMaxVideo(doc: Document): HTMLVideoElement | null {
  const candidates = Array.from(doc.querySelectorAll<HTMLVideoElement>(mainVideo))
    .filter(video => video.parentElement && isVisibleInPlayer(video, video.parentElement));
  return candidates.length === 1 ? candidates[0]! : null;
}

export function hboMaxMediaSource(video: HTMLVideoElement) {
  return video.currentSrc || video.src;
}

export function isHboMaxAd(player: HTMLElement) {
  return Array.from(player.querySelectorAll('[data-testid="ad"]'))
    .some(ad => isVisibleInPlayer(ad, player) ||
      Array.from(ad.children).some(child => isVisibleInPlayer(child, player)));
}
