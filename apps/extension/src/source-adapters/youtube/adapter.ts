import { Html5VideoAdapter } from "../core/html5-video-adapter";
import type {
  PlayerOverlayGeometry,
  PlayerOverlayGeometryListener,
} from "../core/overlay-geometry";
import { normalizeVideoFingerprint } from "../core/source-url";
import type {
  AdapterOverlayBinding,
  AdapterPlaybackSnapshot,
  PlayerEvent,
} from "../core/types";
import { YouTubePlaybackPhaseTracker } from "./playback-phase";
import {
  getYouTubePlayerOverlayGeometry,
  subscribeYouTubePlayerOverlayGeometry,
} from "./player-chrome";
import { getYouTubeFingerprintKey, parseYouTubeVideoId } from "./url";

interface YouTubeVolumePlayer extends HTMLElement {
  getVolume?: () => number;
  setVolume?: (volume: number) => void;
  isMuted?: () => boolean;
  mute?: () => void;
  unMute?: () => void;
}

export class YouTubeVideoAdapter extends Html5VideoAdapter {
  override readonly id = "youtube";
  override readonly provider = "youtube" as const;
  override readonly name = "YouTube";
  private readonly playbackPhaseTracker: YouTubePlaybackPhaseTracker;

  constructor(video: HTMLVideoElement, container: HTMLElement) {
    super(video, container);
    const expectedVideoId = parseYouTubeVideoId(new URL(location.href));
    this.playbackPhaseTracker = new YouTubePlaybackPhaseTracker({
      video,
      player: container,
      expectedVideoId,
      getCurrentVideoId: () => parseYouTubeVideoId(new URL(location.href)),
    });
  }

  override getTitle(): string | null {
    const title =
      document.querySelector<HTMLHeadingElement>("h1.ytd-watch-metadata")?.innerText ??
      document.querySelector<HTMLMetaElement>('meta[name="title"]')?.content ??
      super.getTitle();
    return title?.trim() || null;
  }

  override getFingerprint(): string {
    return normalizeVideoFingerprint(`youtube|${getYouTubeFingerprintKey(new URL(location.href))}`);
  }

  override getCurrentTime(): number {
    return this.playbackPhaseTracker.getSnapshot().contentTime;
  }

  override getPlaybackSnapshot(): AdapterPlaybackSnapshot {
    return this.playbackPhaseTracker.getSnapshot();
  }

  override subscribe(callback: (event: PlayerEvent) => void): () => void {
    let disposed = false;
    const disposePhaseTracker = this.playbackPhaseTracker.subscribe((snapshot) => {
      callback({ type: "phasechange", snapshot });
    });
    const disposeMediaEvents = super.subscribe((event) => {
      if (this.getPlaybackSnapshot().phase === "content") {
        callback(event);
      }
    });

    return () => {
      if (disposed) {
        return;
      }
      disposed = true;
      disposePhaseTracker();
      disposeMediaEvents();
    };
  }

  override getOverlayGeometry(): PlayerOverlayGeometry {
    return getYouTubePlayerOverlayGeometry(this.container);
  }

  override getOverlayBinding(): AdapterOverlayBinding {
    return {
      mountTarget: this.container,
      fillMountTarget: true,
      useNativePlayerDoubleClick: true,
    };
  }

  override subscribeOverlayGeometry(listener: PlayerOverlayGeometryListener): () => void {
    return subscribeYouTubePlayerOverlayGeometry(this.container, listener);
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

function clampVolumePercent(volume: number): number {
  if (!Number.isFinite(volume)) {
    return 100;
  }

  return Math.max(0, Math.min(100, volume));
}
