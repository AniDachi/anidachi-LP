import { describe, expect, it } from "vitest";
import { getOverlayMountDecision } from "../src/overlay-mount";

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
});
