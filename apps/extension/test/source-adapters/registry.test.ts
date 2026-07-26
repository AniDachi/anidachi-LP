import { describe, expect, it } from "vitest";
import { getDefinitionForProvider, detectSourceAdapter } from "../../src/source-adapters/registry";

describe("source adapter registry", () => {
  it("orders provider priorities from YouTube to Crunchyroll to Generic", () => {
    const youtube = getDefinitionForProvider("youtube");
    const crunchyroll = getDefinitionForProvider("crunchyroll");
    const generic = getDefinitionForProvider("generic");

    expect(youtube).toMatchObject({ priority: 300, provider: "youtube" });
    expect(crunchyroll).toMatchObject({ priority: 200, provider: "crunchyroll" });
    expect(generic).toMatchObject({ priority: 100, provider: "generic" });
    expect(youtube?.priority).toBeGreaterThan(crunchyroll?.priority ?? 0);
    expect(crunchyroll?.priority).toBeGreaterThan(generic?.priority ?? 0);
  });

  it("uses the YouTube definition first when multiple providers recognize the selected video", () => {
    mockLocation("https://www.crunchyroll.com/watch/G8WUNM123/example-episode");
    document.body.innerHTML = `
      <div id="player-container">
        <div id="movie_player" class="html5-video-player">
          <video></video>
        </div>
      </div>
    `;
    const video = document.querySelector("video") as HTMLVideoElement;
    mockRect(video, 640, 360);
    mockRect(document.querySelector("#movie_player") as HTMLElement, 960, 540);
    mockRect(document.querySelector("#player-container") as HTMLElement, 960, 540);

    const adapter = detectSourceAdapter(document);

    expect(adapter?.id).toBe("youtube");
    expect(adapter?.video).toBe(video);
  });

  it("uses the Crunchyroll definition on the current Crunchyroll player route", () => {
    mockLocation("https://www.crunchyroll.com/watch/G8WUNM123/example-episode");
    document.body.innerHTML = `
      <div id="player-container"><video></video></div>
    `;
    const video = document.querySelector("video") as HTMLVideoElement;
    mockRect(video, 640, 360);
    mockRect(document.querySelector("#player-container") as HTMLElement, 960, 540);

    const adapter = detectSourceAdapter(document);

    expect(adapter?.id).toBe("crunchyroll");
  });

  it("falls back to the Generic definition when no provider-specific definition matches", () => {
    mockLocation("https://example.com/watch/episode-1");
    document.body.innerHTML = `
      <main id="player"><video></video></main>
    `;
    const video = document.querySelector("video") as HTMLVideoElement;
    mockRect(video, 640, 360);
    mockRect(document.querySelector("#player") as HTMLElement, 640, 360);

    const adapter = detectSourceAdapter(document);

    expect(adapter?.id).toBe("generic-html5-video");
    expect(adapter?.container.id).toBe("player");
  });

  it("keeps the first equally-scored video as the deterministic selected candidate", () => {
    mockLocation("https://example.com/watch/episode-1");
    document.body.innerHTML = `
      <main id="first"><video></video></main>
      <main id="second"><video></video></main>
    `;
    const first = document.querySelector("#first video") as HTMLVideoElement;
    const second = document.querySelector("#second video") as HTMLVideoElement;
    mockRect(first, 640, 360);
    mockRect(second, 640, 360);
    mockRect(document.querySelector("#first") as HTMLElement, 640, 360);
    mockRect(document.querySelector("#second") as HTMLElement, 640, 360);

    const adapter = detectSourceAdapter(document);

    expect(adapter?.video).toBe(first);
  });
});

function mockLocation(url: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(url),
  });
}

function mockRect(element: Element, width: number, height: number): void {
  element.getBoundingClientRect = () =>
    ({
      bottom: height,
      height,
      left: 0,
      right: width,
      top: 0,
      width,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}
