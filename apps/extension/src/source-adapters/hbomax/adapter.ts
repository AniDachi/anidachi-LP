import {
  hboMaxArtworkUrl, hboMaxFingerprint, hboMaxPlaybackId, hboMaxSourceUrl, MAX_WATCH_TITLE_CHARS,
  type PlaybackState, type WatchSourceDescriptor,
} from "@anidachi/protocol";
import { Html5VideoAdapter } from "../core/html5-video-adapter";
import type { PlayerOverlayGeometryListener } from "../core/overlay-geometry";
import type { AdapterPlaybackSnapshot, PersonalResumeTarget, PlayerEvent } from "../core/types";
import { readHboMaxPlaybackMetadata, readHboMaxPlayerTitle } from "./metadata";
import { readHboClock } from "./content-clock";
import { isHboMaxAd } from "./player";
import { hboMaxOverlayGeometry, subscribeHboMaxGeometry } from "./player-chrome";

export class HboMaxVideoAdapter extends Html5VideoAdapter {
  override readonly id = "hbomax";
  override readonly provider = "hbomax" as const;
  override readonly name = "HBO Max";
  readonly enforcesAuthoritativeRoomSource = true;
  private readonly playbackId = hboMaxPlaybackId(location.href);

  override getFingerprint() { return hboMaxFingerprint(this.playbackId ?? "unknown"); }

  private phase(clock = readHboClock(this.video)): AdapterPlaybackSnapshot["phase"] {
    const video = this.video;
    if (!this.playbackId || this.playbackId !== hboMaxPlaybackId(location.href) ||
        !video.isConnected || video.parentElement !== this.container) return "transition";
    if (isHboMaxAd(this.container)) return "interstitial";
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.readyState < 1) return "transition";
    const max = this.container.querySelector('[data-testid="player-ux-scrubber-position"]')?.getAttribute("aria-valuemax");
    if (!clock || (max && Math.abs(Number(max) - video.duration) > 2 && Math.abs(Number(max) - clock.duration) > 2)) return "transition";
    if (!clock.inMain) return "interstitial";
    return video.seeking || video.readyState < 3 ? "buffering" : "content";
  }

  override getPlaybackSnapshot(): AdapterPlaybackSnapshot {
    const clock = readHboClock(this.video);
    const phase = this.phase(clock);
    const content = phase === "content" || phase === "buffering";
    return {
      phase, contentTime: content && clock ? clock.position : 0, playing: content && !this.video.paused,
      capturedAt: Date.now(), playbackRate: this.video.playbackRate || 1,
    };
  }
  override getCurrentTime() { return this.getPlaybackSnapshot().contentTime; }

  override getState(): PlaybackState {
    const snapshot = this.getPlaybackSnapshot();
    return {
      videoFingerprint: this.getFingerprint(), hostTime: snapshot.contentTime, playing: snapshot.playing,
      playbackRate: snapshot.playbackRate, updatedAt: snapshot.capturedAt,
      ...(this.playbackId && { sourceUrl: hboMaxSourceUrl(this.playbackId) }),
    };
  }

  override getTitle() {
    return this.playbackId && this.playbackId === hboMaxPlaybackId(location.href)
      ? readHboMaxPlayerTitle(this.video.ownerDocument, this.playbackId) : null;
  }

  override getSourceDescriptor(): WatchSourceDescriptor | undefined {
    const clock = readHboClock(this.video);
    if (!this.playbackId || !clock || this.phase(clock) !== "content") return undefined;
    const metadata = readHboMaxPlaybackMetadata(this.video.ownerDocument, this.playbackId);
    const url = hboMaxSourceUrl(this.playbackId);
    const posterUrl = metadata?.artworkUrl && hboMaxArtworkUrl(metadata.artworkUrl);
    return {
      provider: this.provider, videoFingerprint: this.getFingerprint(), sourceUrl: url, canonicalUrl: url,
      title: (metadata?.displayTitle || this.getTitle() || this.name).slice(0, MAX_WATCH_TITLE_CHARS), duration: clock.duration,
      ...(posterUrl && { posterUrl }),
      ...(metadata?.identity && { hbomaxIdentity: metadata.identity }),
      ...(metadata?.identity.kind === "episode" && {
        seriesTitle: metadata.title.slice(0, MAX_WATCH_TITLE_CHARS),
        episodeTitle: metadata.episodeTitle.slice(0, MAX_WATCH_TITLE_CHARS),
        ...(metadata.seasonNumber != null && { seasonNumber: metadata.seasonNumber }),
        ...(metadata.episodeNumber != null && { episodeNumber: metadata.episodeNumber }),
      }),
    };
  }

  override async play() {
    if (this.phase() !== "content") throw new Error("HBO Max content is not ready");
    await this.video.play();
  }
  async resumeInterstitial(signal: AbortSignal) {
    if (signal.aborted || this.phase() !== "interstitial") return;
    await this.video.play();
  }
  override pause() { if (this.phase() === "content") this.video.pause(); }
  override setPlaybackRate(rate: number) { if (this.phase() === "content") super.setPlaybackRate(rate); }
  override seek(time: number) {
    this.seekContent(time);
  }
  private seekContent(time: number) {
    if (!Number.isFinite(time)) return false;
    const clock = readHboClock(this.video, time);
    if (clock?.streamTarget == null || this.phase(clock) !== "content") return false;
    this.video.currentTime = clock.streamTarget;
    return true;
  }

  async getPersonalResumeReadiness(target: PersonalResumeTarget) {
    if (target.expiresAt <= Date.now() || !this.playbackId || hboMaxPlaybackId(target.sourceUrl) !== this.playbackId ||
        this.playbackId !== hboMaxPlaybackId(location.href)) return "cancelled" as const;
    const clock = readHboClock(this.video);
    return clock && this.phase(clock) === "content" && target.currentTime >= 0 && target.currentTime <= clock.duration
      ? "ready" as const : "waiting" as const;
  }
  async seekPersonalResume(target: PersonalResumeTarget, guard: () => boolean) {
    const ready = await this.getPersonalResumeReadiness(target);
    if (ready !== "ready") return ready;
    if (!guard() || target.expiresAt <= Date.now()) return "cancelled" as const;
    return this.seekContent(target.currentTime) ? "consumed" as const : "waiting" as const;
  }

  override subscribe(callback: (event: PlayerEvent) => void) {
    let last = this.phase();
    const update = () => {
      const snapshot = this.getPlaybackSnapshot();
      if (last !== snapshot.phase) {
        last = snapshot.phase;
        callback({ type: "phasechange", snapshot });
      }
    };
    const native = super.subscribe(event => {
      update();
      if (last === "content") callback(event);
    });
    const events = ["loadstart", "emptied", "loadedmetadata", "waiting", "playing", "canplay", "seeking", "seeked"];
    for (const event of events) this.video.addEventListener(event, update);
    // The native scrubber changes its inline fill style on every playback tick.
    const observer = new MutationObserver(records => {
      if (records.some(record => record.type === "childList" || record.attributeName === "aria-valuemax" ||
          (record.target instanceof Element && (record.target.closest('[data-testid="ad"]') ||
            record.target.querySelector('[data-testid="ad"]'))))) update();
    });
    observer.observe(this.container, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden", "aria-valuemax"] });
    return () => {
      native();
      observer.disconnect();
      for (const event of events) this.video.removeEventListener(event, update);
    };
  }

  override getOverlayBinding() {
    return { mountTarget: this.container, fillMountTarget: true, useNativePlayerDoubleClick: true };
  }
  override getOverlayGeometry() { return hboMaxOverlayGeometry(this.container); }
  override subscribeOverlayGeometry(listener: PlayerOverlayGeometryListener) { return subscribeHboMaxGeometry(this.container, listener); }

  override isFullscreen() {
    const element = this.container.ownerDocument.fullscreenElement;
    return !!element && (element.contains(this.container) || element === this.video);
  }
  override async enterFullscreen() {
    if (this.isFullscreen()) return;
    const native = this.container.querySelector<HTMLElement>('[data-testid="player-ux-fullscreen-button"]');
    if (native) native.click();
    else await super.enterFullscreen();
  }
}
