import { describe, expect, it, vi } from "vitest";
import { attachAndPlayVideoElement } from "../src/media-element-playback";

describe("media element playback", () => {
  it("resumes the same video element whenever it is attached again", async () => {
    const firstContainer = document.createElement("div");
    const secondContainer = document.createElement("div");
    const video = document.createElement("video");
    const play = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(video, "play", { configurable: true, value: play });

    await attachAndPlayVideoElement(firstContainer, video);
    firstContainer.remove();
    await attachAndPlayVideoElement(secondContainer, video);

    expect(firstContainer.childElementCount).toBe(0);
    expect(secondContainer.firstElementChild).toBe(video);
    expect(play).toHaveBeenCalledTimes(2);
  });
});
