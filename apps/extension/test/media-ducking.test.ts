import { describe, expect, it } from "vitest";
import { duckVideoVolume } from "../src/media-ducking";

describe("video volume ducking", () => {
  it("temporarily lowers volume to at most 10 percent and restores it", () => {
    const video = document.createElement("video");
    video.volume = 0.8;
    video.muted = false;

    const restore = duckVideoVolume(video);

    expect(video.volume).toBe(0.1);

    restore();

    expect(video.volume).toBe(0.8);
    expect(video.muted).toBe(false);
  });

  it("does not raise an already quiet video", () => {
    const video = document.createElement("video");
    video.volume = 0.05;

    const restore = duckVideoVolume(video);

    expect(video.volume).toBe(0.05);

    restore();

    expect(video.volume).toBe(0.05);
  });
});
