import { describe, expect, it } from "vitest";
import {
  getOverlayMountDecision,
  getOverlayPageDecision,
  isOverlayAllowedOnPage,
  mutationsAffectVideo,
  shouldRefreshSameVideoAdapter,
} from "../src/overlay-mount";

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

  it("allows Crunchyroll overlays only on watch routes", () => {
    expect(isOverlayAllowedOnPage("https://www.crunchyroll.com/watch/G14U4D0PE/example")).toBe(
      true,
    );
    expect(isOverlayAllowedOnPage("https://www.crunchyroll.com/")).toBe(false);
    expect(isOverlayAllowedOnPage("https://www.crunchyroll.com/videos/popular")).toBe(false);
  });

  it("allows YouTube overlays only on full watch pages", () => {
    expect(isOverlayAllowedOnPage("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isOverlayAllowedOnPage("https://youtu.be/dQw4w9WgXcQ")).toBe(true);

    expect(isOverlayAllowedOnPage("https://www.youtube.com/")).toBe(false);
    expect(isOverlayAllowedOnPage("https://www.youtube.com/results?search_query=anime")).toBe(
      false,
    );
    expect(isOverlayAllowedOnPage("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(false);
    expect(isOverlayAllowedOnPage("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(false);
    expect(isOverlayAllowedOnPage("https://www.youtube.com/watch")).toBe(false);
    expect(isOverlayAllowedOnPage("https://www.youtube.com/watch?v=short")).toBe(false);
  });

  it("disposes a mounted overlay after leaving a Crunchyroll watch route", () => {
    expect(getOverlayPageDecision(true, "https://www.crunchyroll.com/")).toBe("dispose");
    expect(getOverlayPageDecision(false, "https://www.crunchyroll.com/")).toBe("idle");
    expect(
      getOverlayPageDecision(true, "https://www.crunchyroll.com/watch/G14U4D0PE/example"),
    ).toBe("continue");
  });

  it("disposes a mounted overlay after leaving a YouTube watch route", () => {
    expect(getOverlayPageDecision(true, "https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "dispose",
    );
    expect(getOverlayPageDecision(false, "https://www.youtube.com/")).toBe("idle");
    expect(
      getOverlayPageDecision(true, "https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("continue");
  });

  it("treats removal of a nested video player as a lifecycle change", async () => {
    const container = document.createElement("div");
    const player = document.createElement("section");
    player.append(document.createElement("video"));
    container.append(player);
    document.body.append(container);

    const recordsPromise = new Promise<MutationRecord[]>((resolve) => {
      const observer = new MutationObserver((records) => {
        observer.disconnect();
        resolve(records);
      });
      observer.observe(container, { childList: true, subtree: true });
    });

    player.remove();

    expect(mutationsAffectVideo(await recordsPromise)).toBe(true);
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
