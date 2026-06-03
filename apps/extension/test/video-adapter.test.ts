import { describe, expect, it, vi } from "vitest";
import {
  CRUNCHYROLL_CONTROL_RESULT_SOURCE,
  CRUNCHYROLL_CONTROL_SOURCE,
  type CrunchyrollControlRequest,
  type CrunchyrollControlResult,
} from "../src/crunchyroll-control";
import { findBestVideoAdapter, runCrunchyrollMainCommand } from "../src/video-adapter";

describe("generic video adapter detection", () => {
  it("selects the largest visible video", () => {
    document.body.innerHTML = `
      <div id="small"><video style="width: 80px; height: 45px;"></video></div>
      <div id="large"><video style="width: 640px; height: 360px;"></video></div>
    `;
    mockRect(document.querySelector("#small video"), 80, 45);
    mockRect(document.querySelector("#small"), 80, 45);
    mockRect(document.querySelector("#large video"), 640, 360);
    mockRect(document.querySelector("#large"), 640, 360);

    const adapter = findBestVideoAdapter();

    expect(adapter?.container.id).toBe("large");
  });

  it("ignores hidden videos", () => {
    document.body.innerHTML = `
      <div id="hidden"><video style="display: none; width: 900px; height: 500px;"></video></div>
      <div id="visible"><video style="width: 320px; height: 180px;"></video></div>
    `;
    mockRect(document.querySelector("#hidden video"), 900, 500);
    mockRect(document.querySelector("#hidden"), 900, 500);
    mockRect(document.querySelector("#visible video"), 320, 180);
    mockRect(document.querySelector("#visible"), 320, 180);

    const adapter = findBestVideoAdapter();

    expect(adapter?.container.id).toBe("visible");
  });

  it("uses the YouTube player container on YouTube pages", () => {
    document.body.innerHTML = `
      <div id="movie_player" class="html5-video-player">
        <div id="inner-video-wrap"><video style="width: 640px; height: 360px;"></video></div>
      </div>
    `;
    mockRect(document.querySelector("video"), 640, 360);
    mockRect(document.querySelector("#inner-video-wrap"), 640, 360);
    mockRect(document.querySelector("#movie_player"), 960, 540);

    const adapter = findBestVideoAdapter();

    expect(adapter?.id).toBe("youtube");
    expect(adapter?.container.id).toBe("movie_player");
  });

  it("uses a LAN-stable generic fingerprint for the same page video", () => {
    history.replaceState(null, "", "/watch#anidachiRoom=host");
    document.body.innerHTML = `
      <main id="player">
        <video src="http://localhost:5174/demo.mp4" style="width: 640px; height: 360px;"></video>
      </main>
    `;
    mockRect(document.querySelector("video"), 640, 360);
    mockRect(document.querySelector("#player"), 640, 360);

    const hostFingerprint = findBestVideoAdapter()?.getFingerprint();

    document.querySelector("video")?.setAttribute("src", "http://192.168.1.80:5174/demo.mp4");
    const viewerFingerprint = findBestVideoAdapter()?.getFingerprint();

    expect(viewerFingerprint).toBe(hostFingerprint);
  });

  it("uses a YouTube-stable fingerprint instead of transient media src", () => {
    history.replaceState(null, "", "/watch?v=abc123#anidachiRoom=host");
    document.body.innerHTML = `
      <h1 class="ytd-watch-metadata">Same video</h1>
      <div id="movie_player" class="html5-video-player">
        <video src="https://rr1---sn.googlevideo.com/videoplayback?id=one" style="width: 640px; height: 360px;"></video>
      </div>
    `;
    mockRect(document.querySelector("video"), 640, 360);
    mockRect(document.querySelector("#movie_player"), 960, 540);
    const firstFingerprint = findBestVideoAdapter()?.getFingerprint();

    document
      .querySelector("video")
      ?.setAttribute("src", "https://rr5---sn.googlevideo.com/videoplayback?id=two");
    const secondFingerprint = findBestVideoAdapter()?.getFingerprint();

    expect(secondFingerprint).toBe(firstFingerprint);
  });

  it("uses a Crunchyroll-stable fingerprint instead of transient media src", () => {
    mockHost("www.crunchyroll.com", "/watch/G8WUNM123/example-episode#anidachiRoom=host");
    document.body.innerHTML = `
      <div class="video-player-wrapper">
        <div id="player-container" class="player-container">
          <div class="bitmovinplayer-container">
            <div data-testid="player-controls-root"></div>
            <input class="timeline-slider" type="range" min="0" max="100" step="0.25" value="0" />
            <button data-testid="play-pause-button" type="button">play</button>
            <button data-testid="fullscreen-button" type="button">fullscreen</button>
          </div>
          <video src="https://v.vrv.co/evs1/token-host/master.m3u8" style="width: 640px; height: 360px;"></video>
        </div>
      </div>
    `;
    mockRect(document.querySelector("video"), 640, 360);
    mockRect(document.querySelector(".bitmovinplayer-container"), 640, 360);
    mockRect(document.querySelector("#player-container"), 960, 540);
    mockRect(document.querySelector(".video-player-wrapper"), 960, 540);
    const firstFingerprint = findBestVideoAdapter()?.getFingerprint();

    document
      .querySelector("video")
      ?.setAttribute("src", "https://v.vrv.co/evs1/token-viewer/master.m3u8");
    const adapter = findBestVideoAdapter();

    expect(adapter?.id).toBe("crunchyroll");
    expect(adapter?.container.id).toBe("player-container");
    expect(adapter?.getFingerprint()).toBe(firstFingerprint);
    expect(adapter?.getFingerprint()).toBe("crunchyroll|watch/G8WUNM123");
  });

  it("does not click Crunchyroll play/pause UI when programmatic play fails", async () => {
    mockHost("www.crunchyroll.com", "/watch/G8WUNM123/example-episode");
    document.body.innerHTML = `
      <div id="player-container">
        <button data-testid="play-pause-button" type="button">play</button>
        <video style="width: 640px; height: 360px;"></video>
      </div>
    `;
    const video = document.querySelector("video") as HTMLVideoElement;
    const button = document.querySelector("button") as HTMLButtonElement;
    const click = vi.fn();
    button.addEventListener("click", click);
    video.play = vi.fn().mockRejectedValue(new Error("blocked"));
    video.pause = vi.fn();
    Object.defineProperty(video, "paused", { configurable: true, value: true });
    mockRect(video, 640, 360);
    mockRect(document.querySelector("#player-container"), 960, 540);
    const stopBridge = mockCrunchyrollBridge(() => ({ error: "blocked", ok: false }));

    await findBestVideoAdapter()?.play();

    expect(video.play).toHaveBeenCalledTimes(1);
    expect(click).not.toHaveBeenCalled();
    stopBridge();
  });

  it("uses the Crunchyroll main-world play bridge without clicking the UI", async () => {
    mockHost("www.crunchyroll.com", "/watch/G8WUNM123/example-episode");
    document.body.innerHTML = `
      <div id="player-container">
        <button data-testid="play-pause-button" type="button">play</button>
        <video style="width: 640px; height: 360px;"></video>
      </div>
    `;
    const video = document.querySelector("video") as HTMLVideoElement;
    const button = document.querySelector("button") as HTMLButtonElement;
    const click = vi.fn();
    button.addEventListener("click", click);
    video.play = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(video, "paused", { configurable: true, value: true });
    mockRect(video, 640, 360);
    mockRect(document.querySelector("#player-container"), 960, 540);
    const stopBridge = mockCrunchyrollBridge((request) => {
      expect(request.action).toBe("play");
      return { ok: true };
    });

    await findBestVideoAdapter()?.play();

    expect(video.play).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    stopBridge();
  });

  it("sends Crunchyroll seamless navigation through the main-world bridge", async () => {
    const targetUrl = "https://www.crunchyroll.com/ru/watch/G8NEXT123/next-episode";
    const stopBridge = mockCrunchyrollBridge((request) => {
      expect(request.action).toBe("navigate");
      expect(request.url).toBe(targetUrl);
      return { currentUrl: targetUrl, method: "next-episode-click", ok: true };
    });

    const result = await runCrunchyrollMainCommand("navigate", { url: targetUrl });

    expect(result).toMatchObject({
      currentUrl: targetUrl,
      method: "next-episode-click",
      ok: true,
    });
    stopBridge();
  });

  it("pauses Crunchyroll through the main-world bridge before touching the UI", async () => {
    mockHost("www.crunchyroll.com", "/watch/G8WUNM123/example-episode");
    document.body.innerHTML = `
      <div id="player-container">
        <button data-testid="play-pause-button" type="button">pause</button>
        <video style="width: 640px; height: 360px;"></video>
      </div>
    `;
    const video = document.querySelector("video") as HTMLVideoElement;
    const button = document.querySelector("button") as HTMLButtonElement;
    const click = vi.fn();
    let paused = false;
    button.addEventListener("click", click);
    video.pause = vi.fn(() => {
      paused = true;
    });
    Object.defineProperty(video, "paused", {
      configurable: true,
      get: () => paused,
    });
    mockRect(video, 640, 360);
    mockRect(document.querySelector("#player-container"), 960, 540);
    const stopBridge = mockCrunchyrollBridge((request) => {
      expect(request.action).toBe("pause");
      video.pause();
      return { ok: true };
    });

    findBestVideoAdapter()?.pause();
    await waitForAsync(() => expect(video.pause).toHaveBeenCalledTimes(1));

    expect(video.pause).toHaveBeenCalledTimes(1);
    expect(click).not.toHaveBeenCalled();
    stopBridge();
  });

  it("uses Crunchyroll native fullscreen control before falling back to requestFullscreen", async () => {
    mockHost("www.crunchyroll.com", "/watch/G8WUNM123/example-episode");
    document.body.innerHTML = `
      <div id="player-container">
        <button data-testid="fullscreen-button" type="button">fullscreen</button>
        <video style="width: 640px; height: 360px;"></video>
      </div>
    `;
    const video = document.querySelector("video") as HTMLVideoElement;
    const button = document.querySelector("button") as HTMLButtonElement;
    const click = vi.fn();
    button.addEventListener("click", click);
    const requestFullscreen = vi.fn();
    Object.assign(document.querySelector("#player-container") as HTMLElement, {
      requestFullscreen,
    });
    mockRect(video, 640, 360);
    mockRect(document.querySelector("#player-container"), 960, 540);

    await findBestVideoAdapter()?.enterFullscreen();

    expect(click).toHaveBeenCalledTimes(1);
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it("seeks Crunchyroll through the main-world bridge before touching timeline fallback", async () => {
    mockHost("www.crunchyroll.com", "/watch/G8WUNM123/example-episode");
    document.body.innerHTML = `
      <div id="player-container">
        <div data-testid="timeline-controls-container">
          <input class="timeline-slider" type="range" min="0" max="100" step="0.25" value="10" />
        </div>
        <button data-testid="jump-forward-button" type="button">forward</button>
        <button data-testid="jump-backward-button" type="button">back</button>
        <video style="width: 640px; height: 360px;"></video>
      </div>
    `;
    const video = document.querySelector("video") as HTMLVideoElement;
    const input = document.querySelector("input") as HTMLInputElement;
    const inputEvents = vi.fn();
    const changeEvents = vi.fn();
    let currentTime = 10;
    Object.defineProperty(video, "duration", { configurable: true, value: 100 });
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value;
      },
    });
    input.addEventListener("input", () => {
      inputEvents();
      currentTime = Number(input.value);
    });
    input.addEventListener("change", changeEvents);
    mockRect(video, 640, 360);
    mockRect(document.querySelector("#player-container"), 960, 540);
    const stopBridge = mockCrunchyrollBridge((request) => {
      expect(request.action).toBe("seek");
      currentTime = request.time ?? currentTime;
      return { ok: true };
    });

    findBestVideoAdapter()?.seek(42);
    await waitForAsync(() => expect(video.currentTime).toBe(42));

    expect(input.value).toBe("10");
    expect(inputEvents).not.toHaveBeenCalled();
    expect(changeEvents).not.toHaveBeenCalled();
    expect(video.currentTime).toBe(42);
    stopBridge();
  });

  it("does not use direct currentTime fallback when the Crunchyroll bridge reports a stale seek", async () => {
    mockHost("www.crunchyroll.com", "/watch/G8WUNM123/example-episode");
    document.body.innerHTML = `
      <div id="player-container">
        <video style="width: 640px; height: 360px;"></video>
      </div>
    `;
    const video = document.querySelector("video") as HTMLVideoElement;
    let currentTime = 10;
    Object.defineProperty(video, "duration", { configurable: true, value: 100 });
    Object.defineProperty(video, "seeking", { configurable: true, value: false });
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value;
      },
    });
    mockRect(video, 640, 360);
    mockRect(document.querySelector("#player-container"), 960, 540);
    const stopBridge = mockCrunchyrollBridge((request) => {
      expect(request.action).toBe("seek");
      return {
        method: "stale-main-seek",
        ok: true,
        video: {
          buffered: [],
          currentTime: 10,
          duration: 100,
          ended: false,
          muted: false,
          networkState: 2,
          paused: true,
          playbackRate: 1,
          readyState: 4,
          seeking: false,
          volume: 1,
        },
      };
    });

    findBestVideoAdapter()?.seek(42);
    await waitForAsync(() => expect(video.currentTime).toBe(10));

    stopBridge();
  });

  it("does not use direct currentTime fallback for an already-seeking stale Crunchyroll bridge result", async () => {
    mockHost("www.crunchyroll.com", "/watch/G8WUNM123/example-episode");
    document.body.innerHTML = `
      <div id="player-container">
        <video style="width: 640px; height: 360px;"></video>
      </div>
    `;
    const video = document.querySelector("video") as HTMLVideoElement;
    let currentTime = 10;
    Object.defineProperty(video, "duration", { configurable: true, value: 100 });
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value;
      },
    });
    mockRect(video, 640, 360);
    mockRect(document.querySelector("#player-container"), 960, 540);
    const stopBridge = mockCrunchyrollBridge((request) => {
      expect(request.action).toBe("seek");
      return {
        method: "timeline-input-noop",
        ok: true,
        video: {
          buffered: [[70, 90]],
          currentTime: 10,
          duration: 100,
          ended: false,
          muted: false,
          networkState: 2,
          paused: false,
          playbackRate: 1,
          readyState: 1,
          seeking: true,
          volume: 1,
        },
      };
    });

    findBestVideoAdapter()?.seek(42);
    await waitForAsync(() => expect(video.currentTime).toBe(10));

    stopBridge();
  });

  it("does not auto-resume a Crunchyroll seek by itself", async () => {
    mockHost("www.crunchyroll.com", "/watch/G8WUNM123/example-episode");
    document.body.innerHTML = `
      <div id="player-container">
        <button data-testid="play-pause-button" type="button">play</button>
        <video style="width: 640px; height: 360px;"></video>
      </div>
    `;
    const video = document.querySelector("video") as HTMLVideoElement;
    const button = document.querySelector("button") as HTMLButtonElement;
    const click = vi.fn();
    let paused = false;
    let currentTime = 10;
    button.addEventListener("click", click);
    video.play = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(video, "duration", { configurable: true, value: 100 });
    Object.defineProperty(video, "paused", {
      configurable: true,
      get: () => paused,
    });
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value;
      },
    });
    mockRect(video, 640, 360);
    mockRect(document.querySelector("#player-container"), 960, 540);
    const stopBridge = mockCrunchyrollBridge((request) => {
      expect(request.action).toBe("seek");
      currentTime = request.time ?? currentTime;
      return { ok: true };
    });

    findBestVideoAdapter()?.seek(42);
    paused = true;
    await waitForAsync(() => expect(video.currentTime).toBe(42));

    expect(video.currentTime).toBe(42);
    expect(click).not.toHaveBeenCalled();
    expect(video.play).not.toHaveBeenCalled();
    stopBridge();
  });

  it("does not emit duplicate Crunchyroll play commands for play and playing events", () => {
    mockHost("www.crunchyroll.com", "/watch/G8WUNM123/example-episode");
    document.body.innerHTML = `
      <div id="player-container">
        <video style="width: 640px; height: 360px;"></video>
      </div>
    `;
    const video = document.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(video, "currentTime", { configurable: true, value: 12 });
    mockRect(video, 640, 360);
    mockRect(document.querySelector("#player-container"), 960, 540);
    const adapter = findBestVideoAdapter();
    const callback = vi.fn();
    const unsubscribe = adapter?.subscribe(callback);

    video.dispatchEvent(new Event("play"));
    video.dispatchEvent(new Event("playing"));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ type: "play", time: 12 });
    unsubscribe?.();
  });

  it("ducks YouTube volume through the player API and restores it", () => {
    document.body.innerHTML = `
      <div id="movie_player" class="html5-video-player">
        <video style="width: 640px; height: 360px;"></video>
      </div>
    `;
    const player = document.querySelector("#movie_player") as HTMLElement & {
      getVolume: ReturnType<typeof vi.fn>;
      setVolume: ReturnType<typeof vi.fn>;
      isMuted: ReturnType<typeof vi.fn>;
      mute: ReturnType<typeof vi.fn>;
      unMute: ReturnType<typeof vi.fn>;
    };
    const video = document.querySelector("video") as HTMLVideoElement;
    video.volume = 0.8;
    Object.assign(player, {
      getVolume: vi.fn(() => 72),
      setVolume: vi.fn(),
      isMuted: vi.fn(() => false),
      mute: vi.fn(),
      unMute: vi.fn(),
    });
    mockRect(video, 640, 360);
    mockRect(player, 960, 540);

    const restore = findBestVideoAdapter()?.duckVolume();

    expect(player.setVolume).toHaveBeenCalledWith(10);
    expect(video.volume).toBe(0.1);

    restore?.();

    expect(player.setVolume).toHaveBeenLastCalledWith(72);
    expect(player.unMute).toHaveBeenCalled();
    expect(video.volume).toBe(0.8);
  });
});

function mockRect(element: Element | null, width: number, height: number) {
  if (!element) {
    throw new Error("Missing element");
  }

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

function mockHost(
  host: string,
  path = `${window.location.pathname}${window.location.search}${window.location.hash}`,
) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(`${window.location.protocol}//${host}${path}`),
  });
}

function mockCrunchyrollBridge(
  handler: (
    request: CrunchyrollControlRequest,
  ) => Partial<Omit<CrunchyrollControlResult, "action" | "id" | "source">>,
): () => void {
  const originalPostMessage = window.postMessage.bind(window);
  const postMessage = ((message: unknown, targetOrigin: string, transfer?: Transferable[]) => {
    const request = message as Partial<CrunchyrollControlRequest>;
    if (request.source !== CRUNCHYROLL_CONTROL_SOURCE || typeof request.id !== "string") {
      return originalPostMessage(message, targetOrigin, transfer ?? []);
    }

    const result = handler(request as CrunchyrollControlRequest);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          action: request.action,
          id: request.id,
          ok: result.ok ?? true,
          source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
          ...result,
        },
        source: window,
      }),
    );
  }) as typeof window.postMessage;

  window.postMessage = postMessage;
  return () => {
    window.postMessage = originalPostMessage;
  };
}

async function waitForAsync(assertion: () => void, attempts = 20): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
  }

  throw lastError;
}
