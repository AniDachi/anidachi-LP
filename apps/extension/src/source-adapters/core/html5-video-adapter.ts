import type { PlaybackState } from "@anidachi/protocol";
import { logDebug, videoDebugSnapshot } from "../../debug-log";
import { duckVideoVolume } from "../../media-ducking";
import { buildWatchSourceDescriptor } from "./source-descriptor";
import {
  DEFAULT_PLAYER_OVERLAY_GEOMETRY,
  normalizePlayerOverlayGeometry,
  type PlayerOverlayGeometry,
  type PlayerOverlayGeometryListener,
} from "./overlay-geometry";
import { DEFAULT_PLAYBACK_POLICY } from "./playback-policy";
import { canonicalWatchSourceUrl, normalizeVideoFingerprint } from "./source-url";
import type {
  AdapterOverlayBinding,
  AdapterPlaybackSnapshot,
  PlayerEvent,
  SeekOptions,
  SourceProvider,
  VideoAdapter,
} from "./types";

export class Html5VideoAdapter implements VideoAdapter {
  readonly id: string = "generic-html5-video";
  readonly provider: SourceProvider = "generic";
  readonly name: string = "Generic HTML5 video";
  readonly playbackPolicy = DEFAULT_PLAYBACK_POLICY;

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
    return normalizeVideoFingerprint(
      `html5|${location.pathname}|${getStableVideoSourceKey(this.video)}`,
    );
  }

  getCurrentTime(): number {
    return this.video.currentTime || 0;
  }

  getState(): PlaybackState {
    const sourceUrl = canonicalWatchSourceUrl(location.href);
    return {
      videoFingerprint: this.getFingerprint(),
      ...(sourceUrl ? { sourceUrl } : {}),
      playing: !this.video.paused,
      hostTime: this.getCurrentTime(),
      updatedAt: Date.now(),
      playbackRate: this.video.playbackRate || 1,
    };
  }

  getSourceDescriptor(): ReturnType<typeof buildWatchSourceDescriptor> {
    return buildWatchSourceDescriptor(this, this.getState());
  }

  getPlaybackSnapshot(): AdapterPlaybackSnapshot {
    return {
      phase: "content",
      contentTime: this.getCurrentTime(),
      playing: !this.video.paused,
      playbackRate: this.video.playbackRate || 1,
      capturedAt: Date.now(),
    };
  }

  getOverlayBinding(): AdapterOverlayBinding {
    const fullscreenElement = document.fullscreenElement;
    return {
      mountTarget:
        fullscreenElement instanceof HTMLElement ? fullscreenElement : this.container,
      fillMountTarget: false,
      useNativePlayerDoubleClick: false,
    };
  }

  setPlaybackRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0) {
      return;
    }
    this.video.playbackRate = rate;
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
    const onRateChange = () =>
      callback({
        type: "ratechange",
        time: this.getCurrentTime(),
        playbackRate: this.video.playbackRate || 1,
      });

    this.video.addEventListener("play", onPlay);
    this.video.addEventListener("pause", onPause);
    this.video.addEventListener("seeked", onSeek);
    this.video.addEventListener("timeupdate", onTimeUpdate);
    this.video.addEventListener("ratechange", onRateChange);

    return () => {
      this.video.removeEventListener("play", onPlay);
      this.video.removeEventListener("pause", onPause);
      this.video.removeEventListener("seeked", onSeek);
      this.video.removeEventListener("timeupdate", onTimeUpdate);
      this.video.removeEventListener("ratechange", onRateChange);
    };
  }

  getOverlayGeometry(): PlayerOverlayGeometry {
    const { width, height } = this.container.getBoundingClientRect();
    return normalizePlayerOverlayGeometry({
      ...DEFAULT_PLAYER_OVERLAY_GEOMETRY,
      viewport: { widthPx: width, heightPx: height },
    });
  }

  subscribeOverlayGeometry(_listener: PlayerOverlayGeometryListener): () => void {
    return () => undefined;
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
