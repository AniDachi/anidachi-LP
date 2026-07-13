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
  try {
    const url = new URL(pageUrl);
    const hostname = url.hostname.toLowerCase();
    if (hostname === "crunchyroll.com" || hostname.endsWith(".crunchyroll.com")) {
      return /\/watch\/[^/?#]+/i.test(url.pathname);
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
