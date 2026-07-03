import { describe, expect, it } from "vitest";
import { getOverlayMountDecision, shouldRefreshSameVideoAdapter } from "../src/overlay-mount";

describe("overlay mount decision", () => {
  it("updates the mounted overlay instead of remounting when the detected video changes", () => {
    const mountedVideo = document.createElement("video");
    const nextVideo = document.createElement("video");

    expect(getOverlayMountDecision(mountedVideo, nextVideo)).toBe("update");
  });

  it("relocates the mounted overlay when the detector finds the same video", () => {
    const video = document.createElement("video");

    expect(getOverlayMountDecision(video, video)).toBe("relocate");
  });

  it("mounts the overlay when nothing is currently mounted", () => {
    const video = document.createElement("video");

    expect(getOverlayMountDecision(null, video)).toBe("mount");
  });

  it("refreshes the adapter for a reused video when the source fingerprint changes", () => {
    expect(
      shouldRefreshSameVideoAdapter(
        { id: "crunchyroll", fingerprint: "crunchyroll|watch/old" },
        { id: "crunchyroll", fingerprint: "crunchyroll|watch/new" },
      ),
    ).toBe(true);

    expect(
      shouldRefreshSameVideoAdapter(
        { id: "crunchyroll", fingerprint: "crunchyroll|watch/same" },
        { id: "crunchyroll", fingerprint: "crunchyroll|watch/same" },
      ),
    ).toBe(false);
  });
});
