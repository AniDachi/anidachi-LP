import type { PlaybackState } from "@anidachi/protocol";
import {
  CRUNCHYROLL_CONTROL_RESULT_SOURCE,
  CRUNCHYROLL_CONTROL_SOURCE,
  type CrunchyrollControlAction,
  type CrunchyrollControlResult,
} from "./crunchyroll-control";
import { controlsDebugSnapshot, logDebug, videoDebugSnapshot } from "./debug-log";
import { duckVideoVolume } from "./media-ducking";

export type PlayerEvent =
  | { type: "play"; time: number }
  | { type: "pause"; time: number }
  | { type: "seek"; time: number }
  | { type: "timeupdate"; time: number };

export interface VideoAdapter {
  id: string;
  name: string;
  video: HTMLVideoElement;
  container: HTMLElement;
  getTitle(): string | null;
  getFingerprint(): string;
  getCurrentTime(): number;
  getState(): PlaybackState;
  play(): Promise<void>;
  pause(): void;
  seek(time: number, options?: SeekOptions): void;
  subscribe(callback: (event: PlayerEvent) => void): () => void;
  duckVolume(targetVolume?: number): () => void;
  isFullscreen(): boolean;
  enterFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
}

export interface SeekOptions {
  resumeIfPlaying?: boolean;
}

interface YouTubeVolumePlayer extends HTMLElement {
  getVolume?: () => number;
  setVolume?: (volume: number) => void;
  isMuted?: () => boolean;
  mute?: () => void;
  unMute?: () => void;
}

export class GenericVideoAdapter implements VideoAdapter {
  readonly id: string = "generic-html5-video";
  readonly name: string = "Generic HTML5 video";

  constructor(
    readonly video: HTMLVideoElement,
    readonly container: HTMLElement,
  ) {}

  getTitle(): string | null {
    const title =
      document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ??
      document.title ??
      null;
    return title?.trim() || null;
  }

  getFingerprint(): string {
    return `html5|${location.pathname}|${getStableVideoSourceKey(this.video)}`;
  }

  getCurrentTime(): number {
    return this.video.currentTime || 0;
  }

  getState(): PlaybackState {
    return {
      videoFingerprint: this.getFingerprint(),
      sourceUrl: location.href,
      playing: !this.video.paused,
      hostTime: this.getCurrentTime(),
      updatedAt: Date.now(),
      playbackRate: this.video.playbackRate || 1,
    };
  }

  async play(): Promise<void> {
    logDebug("adapter.generic", "play start", {
      adapterId: this.id,
      video: videoDebugSnapshot(this.video),
    });
    await this.video.play();
    logDebug("adapter.generic", "play resolved", {
      adapterId: this.id,
      video: videoDebugSnapshot(this.video),
    });
  }

  pause(): void {
    logDebug("adapter.generic", "pause start", {
      adapterId: this.id,
      video: videoDebugSnapshot(this.video),
    });
    this.video.pause();
    window.setTimeout(() => {
      logDebug("adapter.generic", "pause after 300ms", {
        adapterId: this.id,
        video: videoDebugSnapshot(this.video),
      });
    }, 300);
  }

  seek(time: number, _options?: SeekOptions): void {
    const target = Math.max(0, Math.min(time, this.video.duration || time));
    logDebug("adapter.generic", "seek start", {
      adapterId: this.id,
      requested: time,
      target,
      video: videoDebugSnapshot(this.video),
    });
    this.video.currentTime = target;
    window.setTimeout(() => {
      logDebug("adapter.generic", "seek after 500ms", {
        adapterId: this.id,
        requested: time,
        target,
        video: videoDebugSnapshot(this.video),
      });
    }, 500);
  }

  subscribe(callback: (event: PlayerEvent) => void): () => void {
    let lastTimeUpdate = 0;
    const onPlay = () => callback({ type: "play", time: this.getCurrentTime() });
    const onPause = () => callback({ type: "pause", time: this.getCurrentTime() });
    const onSeek = () => callback({ type: "seek", time: this.getCurrentTime() });
    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - lastTimeUpdate > 1000) {
        lastTimeUpdate = now;
        callback({ type: "timeupdate", time: this.getCurrentTime() });
      }
    };

    this.video.addEventListener("play", onPlay);
    this.video.addEventListener("pause", onPause);
    this.video.addEventListener("seeked", onSeek);
    this.video.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      this.video.removeEventListener("play", onPlay);
      this.video.removeEventListener("pause", onPause);
      this.video.removeEventListener("seeked", onSeek);
      this.video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }

  duckVolume(targetVolume = 0.1): () => void {
    return duckVideoVolume(this.video, targetVolume);
  }

  isFullscreen(): boolean {
    return (
      document.fullscreenElement === this.container || document.fullscreenElement === this.video
    );
  }

  async enterFullscreen(): Promise<void> {
    await this.container.requestFullscreen();
  }

  async exitFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  }
}

class YouTubeVideoAdapter extends GenericVideoAdapter {
  override readonly id = "youtube";
  override readonly name = "YouTube";

  override getTitle(): string | null {
    const title =
      document.querySelector<HTMLHeadingElement>("h1.ytd-watch-metadata")?.innerText ??
      document.querySelector<HTMLMetaElement>('meta[name="title"]')?.content ??
      super.getTitle();
    return title?.trim() || null;
  }

  override getFingerprint(): string {
    return `youtube|${getYouTubeVideoId() ?? location.pathname}`;
  }

  override isFullscreen(): boolean {
    const fullscreenElement = document.fullscreenElement;
    return (
      this.container.classList.contains("ytp-fullscreen") ||
      fullscreenElement === this.container ||
      (fullscreenElement instanceof HTMLElement &&
        (fullscreenElement.contains(this.container) || this.container.contains(fullscreenElement)))
    );
  }

  override async enterFullscreen(): Promise<void> {
    const button = this.container.querySelector<HTMLButtonElement>(".ytp-fullscreen-button");
    if (button) {
      button.click();
      return;
    }

    await super.enterFullscreen();
  }

  override async exitFullscreen(): Promise<void> {
    const button = this.container.querySelector<HTMLButtonElement>(".ytp-fullscreen-button");
    if (button && this.isFullscreen()) {
      button.click();
      return;
    }

    await super.exitFullscreen();
  }

  override duckVolume(targetVolume = 0.1): () => void {
    const player = this.container as YouTubeVolumePlayer;
    if (typeof player.getVolume !== "function" || typeof player.setVolume !== "function") {
      return super.duckVolume(targetVolume);
    }

    const previousPlayerVolume = clampVolumePercent(player.getVolume());
    const previousVideoVolume = this.video.volume;
    const previousVideoMuted = this.video.muted;
    const wasMuted = typeof player.isMuted === "function" ? player.isMuted() : this.video.muted;
    let restored = false;

    player.setVolume(Math.round(Math.min(previousPlayerVolume, targetVolume * 100)));
    this.video.volume = Math.min(previousVideoVolume, targetVolume);

    return () => {
      if (restored) {
        return;
      }

      restored = true;
      player.setVolume?.(previousPlayerVolume);
      this.video.volume = previousVideoVolume;
      this.video.muted = previousVideoMuted;

      if (wasMuted) {
        player.mute?.();
      } else {
        player.unMute?.();
      }
    };
  }
}

class CrunchyrollVideoAdapter extends GenericVideoAdapter {
  override readonly id = "crunchyroll";
  override readonly name = "Crunchyroll";

  override getTitle(): string | null {
    const title =
      document.querySelector<HTMLHeadingElement>("h1")?.innerText ??
      document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ??
      super.getTitle();
    return title?.trim() || null;
  }

  override getFingerprint(): string {
    return `crunchyroll|${getCrunchyrollVideoKey()}`;
  }

  override async play(): Promise<void> {
    logDebug("adapter.crunchyroll", "play start", {
      video: videoDebugSnapshot(this.video),
      controls: controlsDebugSnapshot(this.container),
    });

    const result = await runCrunchyrollMainCommand("play");
    logDebug("adapter.crunchyroll", "main play result", {
      result,
      video: videoDebugSnapshot(this.video),
    });
    if (result.ok) {
      return;
    }

    await this.playDirectFallback(result.error);
  }

  override pause(): void {
    logDebug("adapter.crunchyroll", "pause start", {
      video: videoDebugSnapshot(this.video),
      controls: controlsDebugSnapshot(this.container),
    });

    void runCrunchyrollMainCommand("pause").then((result) => {
      logDebug("adapter.crunchyroll", "main pause result", {
        result,
        video: videoDebugSnapshot(this.video),
      });
      if (!result.ok) {
        this.video.pause();
      }
    });
  }

  override seek(time: number, options: SeekOptions = {}): void {
    const target = clampMediaTime(time, this.video.duration);
    const wasPlaying = !this.video.paused;
    const shouldResume = options.resumeIfPlaying ?? false;
    logDebug("adapter.crunchyroll", "seek start", {
      requested: time,
      target,
      wasPlaying,
      shouldResume,
      video: videoDebugSnapshot(this.video),
      controls: controlsDebugSnapshot(this.container),
    });

    void runCrunchyrollMainCommand("seek", { time: target }).then((result) => {
      logDebug("adapter.crunchyroll", "main seek result", {
        method: result.method,
        result,
        target,
        timeline: result.timeline,
        video: videoDebugSnapshot(this.video),
      });
      const resultTime = result.video?.currentTime;
      const resultApplied = resultTime === undefined || isNearMediaTime(resultTime, target, 1.25);
      if (!result.ok || !resultApplied) {
        logDebug("adapter.crunchyroll", "seek not applied; direct currentTime fallback disabled", {
          target,
          error: result.error ?? "MAIN_SEEK_DID_NOT_APPLY",
          result,
          video: videoDebugSnapshot(this.video),
        });
      }
      this.logSeekAfter(result.method ?? "main-media-api", target);
    });
  }

  override subscribe(callback: (event: PlayerEvent) => void): () => void {
    let lastTimeUpdate = 0;
    let lastSeekTime = -1;
    const onPlay = () => callback({ type: "play", time: this.getCurrentTime() });
    const onPause = () => callback({ type: "pause", time: this.getCurrentTime() });
    const onSeek = () => {
      const time = this.getCurrentTime();
      if (Math.abs(time - lastSeekTime) < 0.15) {
        return;
      }

      lastSeekTime = time;
      callback({ type: "seek", time });
    };
    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - lastTimeUpdate > 1000) {
        lastTimeUpdate = now;
        callback({ type: "timeupdate", time: this.getCurrentTime() });
      }
    };

    this.video.addEventListener("play", onPlay);
    this.video.addEventListener("pause", onPause);
    this.video.addEventListener("seeking", onSeek);
    this.video.addEventListener("seeked", onSeek);
    this.video.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      this.video.removeEventListener("play", onPlay);
      this.video.removeEventListener("pause", onPause);
      this.video.removeEventListener("seeking", onSeek);
      this.video.removeEventListener("seeked", onSeek);
      this.video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }

  override isFullscreen(): boolean {
    const fullscreenElement = document.fullscreenElement;
    return (
      fullscreenElement === this.container ||
      (fullscreenElement instanceof HTMLElement &&
        (fullscreenElement.contains(this.container) || this.container.contains(fullscreenElement)))
    );
  }

  override async enterFullscreen(): Promise<void> {
    const button = findCrunchyrollFullscreenButton(this.container);
    if (button) {
      button.click();
      return;
    }

    await super.enterFullscreen();
  }

  private async playDirectFallback(reason: string | undefined): Promise<void> {
    logDebug("adapter.crunchyroll", "direct play fallback", {
      reason,
      video: videoDebugSnapshot(this.video),
    });

    try {
      const playPromise = this.video.play();
      playPromise.catch((error) => {
        logDebug("adapter.crunchyroll", "direct play fallback rejected", {
          reason,
          error: error instanceof Error ? error.message : String(error),
          video: videoDebugSnapshot(this.video),
        });
      });
    } catch (error) {
      logDebug("adapter.crunchyroll", "direct play fallback rejected", {
        reason,
        error: error instanceof Error ? error.message : String(error),
        video: videoDebugSnapshot(this.video),
      });
    }
  }

  private logSeekAfter(method: string, target: number): void {
    for (const delay of [300, 1000, 3000]) {
      window.setTimeout(() => {
        logDebug("adapter.crunchyroll", `seek after ${delay}ms`, {
          method,
          target,
          video: videoDebugSnapshot(this.video),
        });
      }, delay);
    }
  }
}

function clampVolumePercent(volume: number): number {
  if (!Number.isFinite(volume)) {
    return 100;
  }

  return Math.max(0, Math.min(100, volume));
}

export function runCrunchyrollMainCommand(
  action: CrunchyrollControlAction,
  payload: {
    contentId?: string;
    locale?: string;
    seriesId?: string;
    time?: number;
    url?: string;
  } = {},
  timeoutMs = action === "seek"
    ? 1000
    : action === "navigate"
      ? 5200
      : action === "seriesPoster"
        ? 3500
        : 450,
): Promise<CrunchyrollControlResult> {
  const id = createMessageId();

  return new Promise((resolve) => {
    let completed = false;
    let timeout = 0;
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
    };
    const complete = (result: CrunchyrollControlResult) => {
      if (completed) {
        return;
      }

      completed = true;
      cleanup();
      resolve(result);
    };
    const onMessage = (event: MessageEvent) => {
      if (
        (event.source && event.source !== window) ||
        !isCrunchyrollControlResult(event.data, id)
      ) {
        return;
      }

      complete(event.data);
    };

    window.addEventListener("message", onMessage);
    timeout = window.setTimeout(() => {
      complete({
        action,
        error: "MAIN_BRIDGE_TIMEOUT",
        id,
        ok: false,
        source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
        timedOut: true,
      });
    }, timeoutMs);

    window.postMessage(
      {
        action,
        id,
        source: CRUNCHYROLL_CONTROL_SOURCE,
        ...payload,
      },
      "*",
    );
  });
}

function isCrunchyrollControlResult(value: unknown, id: string): value is CrunchyrollControlResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CrunchyrollControlResult>;
  return candidate.source === CRUNCHYROLL_CONTROL_RESULT_SOURCE && candidate.id === id;
}

function createMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampMediaTime(time: number, duration: number): number {
  if (!Number.isFinite(time)) {
    return 0;
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, time);
  }

  return Math.max(0, Math.min(time, Math.max(0, duration - 0.25)));
}

function isNearMediaTime(actual: number, target: number, toleranceSeconds: number): boolean {
  return Number.isFinite(actual) && Math.abs(actual - target) <= toleranceSeconds;
}

function getStableVideoSourceKey(video: HTMLVideoElement): string {
  const src = video.currentSrc || video.src;
  if (!src) {
    return getDocumentVideoKey();
  }

  try {
    const url = new URL(src, location.href);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return src;
  }

  return getDocumentVideoKey();
}

function getDocumentVideoKey(): string {
  return `${location.pathname}${location.search}`;
}

function getYouTubeVideoId(): string | null {
  const url = new URL(location.href);
  const watchId = url.searchParams.get("v");
  if (watchId) {
    return watchId;
  }

  const embedMatch = url.pathname.match(/\/(?:embed|shorts)\/([^/?#]+)/);
  return embedMatch?.[1] ?? null;
}

function getCrunchyrollVideoKey(): string {
  const watchMatch = location.pathname.match(/\/watch\/([^/?#]+)/);
  if (watchMatch?.[1]) {
    return `watch/${watchMatch[1]}`;
  }

  return location.pathname.replace(/\/$/, "") || "/";
}

export function findBestVideoAdapter(): VideoAdapter | null {
  const videos = findVideosDeep(document).filter(isUsableVideo);
  const scored = videos
    .map((video) => ({ video, score: scoreVideo(video) }))
    .sort((a, b) => b.score - a.score);

  const winner = scored[0]?.video;
  if (!winner) {
    return null;
  }

  const youtubeContainer = findYouTubePlayerContainer(winner);
  if (youtubeContainer) {
    return new YouTubeVideoAdapter(winner, youtubeContainer);
  }

  const crunchyrollContainer = findCrunchyrollPlayerContainer(winner);
  if (crunchyrollContainer) {
    return new CrunchyrollVideoAdapter(winner, crunchyrollContainer);
  }

  return new GenericVideoAdapter(winner, findPlayerContainer(winner));
}

function findVideosDeep(root: Document | ShadowRoot): HTMLVideoElement[] {
  const videos: HTMLVideoElement[] = [];
  const elements = Array.from(root.querySelectorAll("*"));

  for (const element of elements) {
    if (element instanceof HTMLVideoElement) {
      videos.push(element);
    }

    if (element.shadowRoot) {
      videos.push(...findVideosDeep(element.shadowRoot));
    }
  }

  return videos;
}

function isUsableVideo(video: HTMLVideoElement): boolean {
  const rect = video.getBoundingClientRect();
  const style = getComputedStyle(video);
  return (
    rect.width >= 160 &&
    rect.height >= 90 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
}

function scoreVideo(video: HTMLVideoElement): number {
  const rect = video.getBoundingClientRect();
  const durationBonus = Number.isFinite(video.duration) && video.duration > 60 ? 50000 : 0;
  const playbackBonus = video.paused ? 0 : 100000;
  return rect.width * rect.height + durationBonus + playbackBonus;
}

function findYouTubePlayerContainer(video: HTMLVideoElement): HTMLElement | null {
  const player = video.closest<HTMLElement>("#movie_player, .html5-video-player");
  if (player) {
    return player;
  }

  const fallback = document.querySelector<HTMLElement>("#movie_player, .html5-video-player");
  return fallback?.contains(video) ? fallback : null;
}

function findCrunchyrollPlayerContainer(video: HTMLVideoElement): HTMLElement | null {
  if (!location.hostname.endsWith("crunchyroll.com")) {
    return null;
  }

  const modernContainer = video.closest<HTMLElement>(
    [
      "#player-container",
      ".player-container",
      ".bitmovinplayer-container",
      "[data-testid='player-controls-root']",
      ".video-player-wrapper",
      "[class*='video-player-wrapper']",
    ].join(", "),
  );
  if (modernContainer) {
    if (
      modernContainer.matches(".bitmovinplayer-container, [data-testid='player-controls-root']")
    ) {
      return (
        modernContainer.closest<HTMLElement>("#player-container, .player-container") ??
        modernContainer
      );
    }

    return modernContainer;
  }

  const vilosRoot = video.closest<HTMLElement>("#vilosRoot");
  if (vilosRoot) {
    return vilosRoot;
  }

  const player0 = video.closest<HTMLElement>("#player0");
  if (player0) {
    return player0;
  }

  const platformContainer = video.closest<HTMLElement>(
    [
      "#player-container",
      ".player-container",
      ".watch-video",
      ".video-player-wrapper",
      "[class*='video-player-wrapper']",
      "[class*='VideoPlayer']",
      "[data-testid*='video-player']",
      "[data-testid*='player']",
    ].join(", "),
  );
  if (platformContainer) {
    return platformContainer;
  }

  return findPlayerContainer(video);
}

function findCrunchyrollFullscreenButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>(
    [
      "[data-testid='fullscreen-button']",
      "[data-testid='vilos-fullscreen_button']",
      "[data-testid*='fullscreen' i]",
      "[aria-label*='Full screen' i]",
      "[aria-label*='Fullscreen' i]",
      "[aria-label*='полноэкран' i]",
      "button[class*='fullscreen' i]",
    ].join(", "),
  );
}

function findPlayerContainer(video: HTMLVideoElement): HTMLElement {
  const videoRect = video.getBoundingClientRect();
  let parent = video.parentElement;

  while (parent && parent !== document.body) {
    const rect = parent.getBoundingClientRect();
    const containsVideo = rect.width >= videoRect.width && rect.height >= videoRect.height;
    const widthSlack = Math.max(96, videoRect.width * 0.18);
    const heightSlack = Math.max(96, videoRect.height * 0.22);
    const tightlyWrapsVideo =
      rect.width <= videoRect.width + widthSlack && rect.height <= videoRect.height + heightSlack;

    if (containsVideo && tightlyWrapsVideo) {
      return parent;
    }

    parent = parent.parentElement;
  }

  return video.parentElement ?? document.body;
}
