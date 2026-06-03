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
