import { normalizeVideoFingerprint } from "../core/source-url";
import { Html5VideoAdapter } from "../core/html5-video-adapter";
import { getYouTubeFingerprintKey } from "./url";

interface YouTubeVolumePlayer extends HTMLElement {
  getVolume?: () => number;
  setVolume?: (volume: number) => void;
  isMuted?: () => boolean;
  mute?: () => void;
  unMute?: () => void;
}

export class YouTubeVideoAdapter extends Html5VideoAdapter {
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
    return normalizeVideoFingerprint(`youtube|${getYouTubeFingerprintKey(new URL(location.href))}`);
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
