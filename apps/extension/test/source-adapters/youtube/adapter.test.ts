import { afterEach, describe, expect, it, vi } from "vitest";
import { YouTubeVideoAdapter } from "../../../src/source-adapters/youtube/adapter";
import { youtubeDefinition } from "../../../src/source-adapters/youtube/definition";

describe("YouTube source adapter", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    const mutableDocument = document as unknown as Record<string, unknown>;
    delete mutableDocument.exitFullscreen;
    delete mutableDocument.fullscreenElement;
    vi.restoreAllMocks();
  });

  it("uses the existing player container and YouTube metadata", () => {
    mockLocation("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    document.body.innerHTML = `
      <h1 class="ytd-watch-metadata">Anime opening</h1>
      <div id="movie_player" class="html5-video-player">
        <div><video></video></div>
      </div>
    `;
    const video = document.querySelector("video") as HTMLVideoElement;
    const player = document.querySelector("#movie_player") as HTMLElement;

    const adapter = youtubeDefinition.detect(video);

    expect(youtubeDefinition).toMatchObject({
      id: "youtube",
      provider: "youtube",
      priority: 300,
    });
    expect(adapter).toBeInstanceOf(YouTubeVideoAdapter);
    expect(adapter?.container).toBe(player);
    expect(adapter?.getTitle()).toBe("Anime opening");
    expect(adapter?.getFingerprint()).toBe("youtube|dQw4w9WgXcQ");
  });

  it.each([
    ["https://youtu.be/dQw4w9WgXcQ", "youtube|/dQw4w9WgXcQ"],
    ["https://youtu.be/embed/dQw4w9WgXcQ", "youtube|dQw4w9WgXcQ"],
    ["https://youtu.be/shorts/dQw4w9WgXcQ", "youtube|dQw4w9WgXcQ"],
    ["https://youtu.be/shorts/path-id?v=query-id", "youtube|query-id"],
  ])("keeps the legacy youtu.be fingerprint for %s", (url, fingerprint) => {
    mockLocation(url);
    document.body.innerHTML = `
      <div id="movie_player" class="html5-video-player"><video></video></div>
    `;
    const video = document.querySelector("video") as HTMLVideoElement;

    expect(youtubeDefinition.detect(video)?.getFingerprint()).toBe(fingerprint);
  });

  it("uses the native fullscreen button for enter and exit", async () => {
    document.body.innerHTML = `
      <div id="movie_player" class="html5-video-player ytp-fullscreen">
        <button class="ytp-fullscreen-button" type="button">fullscreen</button>
        <video></video>
      </div>
    `;
    const player = document.querySelector("#movie_player") as HTMLElement;
    const button = document.querySelector("button") as HTMLButtonElement;
    const click = vi.fn();
    const requestFullscreen = vi.fn();
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    button.addEventListener("click", click);
    Object.assign(player, { requestFullscreen });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreen,
    });
    const adapter = youtubeDefinition.detect(document.querySelector("video") as HTMLVideoElement);

    await adapter?.enterFullscreen();
    await adapter?.exitFullscreen();

    expect(click).toHaveBeenCalledTimes(2);
    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it("falls back to the inherited fullscreen APIs without a player button", async () => {
    document.body.innerHTML = `
      <div id="movie_player" class="html5-video-player"><video></video></div>
    `;
    const player = document.querySelector("#movie_player") as HTMLElement;
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.assign(player, { requestFullscreen });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreen,
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: player,
    });
    const adapter = youtubeDefinition.detect(document.querySelector("video") as HTMLVideoElement);

    await adapter?.enterFullscreen();
    await adapter?.exitFullscreen();

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("does not claim a selected video outside the YouTube player", () => {
    document.body.innerHTML = "<video></video>";

    expect(youtubeDefinition.detect(document.querySelector("video") as HTMLVideoElement)).toBeNull();
  });
});

function mockLocation(url: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(url),
  });
}
