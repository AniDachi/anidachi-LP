import { canonicalizeRoomSourceUrl } from "@anidachi/protocol";
import { hasPrimeBrowserHost, parsePrimePageUrl } from "./source-adapters/primevideo/url";
import { netflixWatchId } from "./source-adapters/netflix/contract";
import { disneyPlusWatchId } from "./source-adapters/disneyplus/url";
import {
  isYouTubeProviderHost,
  isYouTubeWatchPage,
} from "./source-adapters/youtube/url";

export type OverlayMountDecision = "mount" | "relocate" | "update";
export type OverlayPageDecision = "continue" | "dispose" | "idle";

export function getOverlayPageDecision(
  hasMountedOverlay: boolean,
  pageUrl: string,
): OverlayPageDecision {
  if (isOverlayAllowedOnPage(pageUrl)) {
    return "continue";
  }

  return hasMountedOverlay ? "dispose" : "idle";
}

export function isOverlayAllowedOnPage(pageUrl: string): boolean {
  if (hasPrimeBrowserHost(pageUrl)) return parsePrimePageUrl(pageUrl) !== null;
  try {
    const url = new URL(pageUrl);
    const hostname = url.hostname.toLowerCase();
    if (hostname === "www.netflix.com") return netflixWatchId(pageUrl) !== null;
    if (hostname === "www.disneyplus.com") return disneyPlusWatchId(pageUrl) !== null;
    if (hostname === "crunchyroll.com" || hostname === "www.crunchyroll.com")
      return canonicalizeRoomSourceUrl(pageUrl, "crunchyroll").ok;
    if (hostname.endsWith(".crunchyroll.com")) {
      return /\/watch\/[^/?#]+/i.test(url.pathname);
    }

    if (isYouTubeProviderHost(hostname)) {
      return isYouTubeWatchPage(url);
    }

    return true;
  } catch {
    return false;
  }
}

export function getOverlayMountDecision(
  mountedVideo: HTMLVideoElement | null,
  nextVideo: HTMLVideoElement,
): OverlayMountDecision {
  if (!mountedVideo) {
    return "mount";
  }

  return mountedVideo === nextVideo ? "relocate" : "update";
}

export function shouldRefreshSameVideoAdapter(
  previous: { id: string; fingerprint: string },
  next: { id: string; fingerprint: string },
): boolean {
  return previous.id !== next.id || previous.fingerprint !== next.fingerprint;
}

export function mutationsAffectVideo(mutations: MutationRecord[]): boolean {
  for (const mutation of mutations) {
    for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
      if (nodeContainsVideo(node)) {
        return true;
      }
    }
  }

  return false;
}

function nodeContainsVideo(node: Node): boolean {
  if (node instanceof HTMLVideoElement) {
    return true;
  }

  return node instanceof Element && node.querySelector("video") !== null;
}
