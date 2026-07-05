export type OverlayMountDecision = "mount" | "relocate" | "update";

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
