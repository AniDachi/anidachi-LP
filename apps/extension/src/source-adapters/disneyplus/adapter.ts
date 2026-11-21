import { disneyPlusFingerprint, disneyPlusSourceUrl, MAX_WATCH_TITLE_CHARS, type PlaybackState, type WatchSourceDescriptor } from "@anidachi/protocol";
import { Html5VideoAdapter } from "../core/html5-video-adapter";
import { DEFAULT_PLAYBACK_POLICY } from "../core/playback-policy";
import type { AdapterPlaybackSnapshot, PersonalResumeTarget, PlayerEvent } from "../core/types";
import { readDisneyPlusPlaybackMetadata, readDisneyPlusPlayerTitle } from "./metadata";
import { DisneyPlusTimeline } from "./timeline";
import { disneyPlusWatchId } from "./url";

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class DisneyPlusVideoAdapter extends Html5VideoAdapter {
  override readonly id = "disneyplus";
  override readonly provider = "disneyplus" as const;
  override readonly name = "Disney+";
  readonly enforcesAuthoritativeRoomSource = true;
  override readonly playbackPolicy = {
    ...DEFAULT_PLAYBACK_POLICY,
    remoteSeekThrottleMs: 2500,
    remoteSeekTargetToleranceSeconds: 1.5,
    pendingSeekGuard: { maxAgeMs: 4000, localTargetToleranceSeconds: 2, remoteTargetToleranceSeconds: 2 },
  };
  private readonly timeline: DisneyPlusTimeline;
  private seekGeneration = 0;
  private readonly listeners = new Set<(event: PlayerEvent) => void>();
  private unsubscribeNative: (() => void) | null = null;

  constructor(video: HTMLVideoElement, container: HTMLElement) {
    super(video, container);
    this.timeline = new DisneyPlusTimeline(video, container, disneyPlusWatchId(location.href));
  }

  invalidatePreviousClock(previous: DisneyPlusVideoAdapter): void {
    this.timeline.discardPrevious(previous.timeline);
  }

  override getFingerprint(): string { return disneyPlusFingerprint(this.timeline.id ?? "unknown"); }

  override getTitle(): string | null {
    return this.timeline.id && this.timeline.isCurrent()
      ? readDisneyPlusPlayerTitle(this.video.ownerDocument, this.timeline.id) : null;
  }

  override getSourceDescriptor(): WatchSourceDescriptor | undefined {
    const position = this.timeline.getPosition();
    const id = this.timeline.id;
    if (!position || !id || this.video.seeking) return undefined;
    const metadata = readDisneyPlusPlaybackMetadata(this.video.ownerDocument, id);
    const title = (metadata?.title || this.getTitle() || this.name).slice(0, MAX_WATCH_TITLE_CHARS);
    const sourceUrl = disneyPlusSourceUrl(id);
    return {
      provider: this.provider, videoFingerprint: this.getFingerprint(), sourceUrl, canonicalUrl: sourceUrl,
      title, duration: position.duration,
      ...(metadata && { disneyplusIdentity: metadata.identity }),
      ...(metadata?.artworkUrl && { posterUrl: metadata.artworkUrl }),
      ...(metadata?.episodeNumber != null && {
        seriesTitle: title, episodeTitle: metadata.episodeTitle.slice(0, MAX_WATCH_TITLE_CHARS),
        episodeNumber: metadata.episodeNumber,
        ...(metadata.seasonNumber != null && { seasonNumber: metadata.seasonNumber }),
      }),
    };
  }

  override getCurrentTime(): number { return this.timeline.getPosition()?.currentTime ?? 0; }

  override getState(): PlaybackState {
    const snapshot = this.getPlaybackSnapshot();
    return {
      videoFingerprint: this.getFingerprint(),
      ...(this.timeline.id && { sourceUrl: disneyPlusSourceUrl(this.timeline.id) }),
      playing: snapshot.playing, hostTime: snapshot.contentTime, updatedAt: snapshot.capturedAt,
      playbackRate: snapshot.playbackRate,
    };
  }

  override getPlaybackSnapshot(): AdapterPlaybackSnapshot {
    const position = this.timeline.getPosition();
    return {
      phase: !position ? (this.timeline.isCurrent() && this.timeline.hasAdUI() ? "interstitial" : "transition")
        : this.video.seeking || this.video.readyState < 3 ? "buffering" : "content",
      contentTime: position?.currentTime ?? 0, playing: !!position && !this.video.paused,
      playbackRate: this.video.playbackRate || 1, capturedAt: Date.now(),
    };
  }

  override getOverlayBinding() {
    return { mountTarget: this.timeline.surface, fillMountTarget: true, useNativePlayerDoubleClick: true };
  }

  override isFullscreen(): boolean {
    const fullscreen = document.fullscreenElement;
    return !!fullscreen && (fullscreen === this.video || fullscreen.contains(this.container) || this.container.contains(fullscreen));
  }

  override async enterFullscreen(): Promise<void> {
    // The native controls portal is a sibling of the video surface.
    await this.video.ownerDocument.documentElement.requestFullscreen();
  }

  override async play(): Promise<void> {
    if (this.getPlaybackSnapshot().phase !== "content") throw new Error("Disney+ content is not ready");
    await this.video.play();
  }

  override pause(): void {
    if (this.getPlaybackSnapshot().phase === "content") this.video.pause();
  }

  override setPlaybackRate(rate: number): void {
    if (this.getPlaybackSnapshot().phase === "content") super.setPlaybackRate(rate);
  }

  private async requestSeek(target: number, guard: () => boolean): Promise<boolean> {
    if (!Number.isFinite(target) || target < 0 || !this.timeline.isCurrent()) return false;
    const generation = ++this.seekGeneration;
    let sent = false;
    for (let attempt = 0; attempt < 35; attempt++) {
      if (generation !== this.seekGeneration || !this.timeline.isCurrent()) return false;
      const position = this.timeline.getPosition();
      if (position && (Math.abs(position.currentTime - target) <= 1 || target > position.duration)) {
        return Math.abs(position.currentTime - target) <= 1 && guard();
      }
      if (!sent && this.getPlaybackSnapshot().phase === "content") {
        if (!guard()) return false;
        sent = this.timeline.seekTo(target);
      }
      if (!sent && attempt === 0) this.timeline.wakeControls();
      await delay(100);
    }
    return false;
  }

  override seek(time: number): void { void this.requestSeek(time, () => true); }

  async getPersonalResumeReadiness(target: PersonalResumeTarget) {
    if (target.expiresAt <= Date.now() || !this.timeline.id ||
        disneyPlusWatchId(target.sourceUrl) !== this.timeline.id || disneyPlusWatchId(location.href) !== this.timeline.id)
      return "cancelled" as const;
    const position = this.timeline.getPosition();
    return position && target.currentTime <= position.duration && this.getPlaybackSnapshot().phase === "content"
      ? "ready" as const : "waiting" as const;
  }

  async seekPersonalResume(target: PersonalResumeTarget, guard: () => boolean) {
    const ready = await this.getPersonalResumeReadiness(target);
    if (ready !== "ready") return ready;
    const ok = await this.requestSeek(target.currentTime, () => target.expiresAt > Date.now() && guard());
    return ok ? "consumed" as const : "waiting" as const;
  }

  override subscribe(callback: (event: PlayerEvent) => void): () => void {
    this.listeners.add(callback);
    if (!this.unsubscribeNative) {
      let previous: AdapterPlaybackSnapshot | null = null;
      let pendingSeek = false;
      let lastTimeUpdate = 0;
      const emit = (event: PlayerEvent) => { for (const listener of this.listeners) listener(event); };
      const read = (event?: Event) => {
        if (event?.type === "emptied" || event?.type === "loadstart" || event?.type === "seeking") {
          this.timeline.reset();
        }
        if (event?.type === "seeking" || event?.type === "seeked") pendingSeek = true;
        const current = this.getPlaybackSnapshot();
        const before = previous;
        previous = current;
        if (current.phase !== before?.phase) emit({ type: "phasechange", snapshot: current });
        if (current.phase !== "content") {
          if (current.phase === "transition") this.timeline.wakeControls();
          return;
        }
        const type = event?.type;
        if (pendingSeek || (before?.phase === "content" &&
            Math.abs(current.contentTime - before.contentTime) >
              3 + Math.max(0, current.capturedAt - before.capturedAt) / 1000 * current.playbackRate)) {
          pendingSeek = false;
          emit({ type: "seek", time: current.contentTime });
        }
        if (type === "play" || type === "pause") emit({ type, time: current.contentTime });
        else if (type === "ratechange") emit({ type, time: current.contentTime, playbackRate: current.playbackRate });
        else if (current.capturedAt - lastTimeUpdate >= 1000) {
          lastTimeUpdate = current.capturedAt;
          emit({ type: "timeupdate", time: current.contentTime });
        }
      };
      const nativeEvents = ["play", "pause", "ratechange", "seeking", "seeked", "emptied", "loadstart",
        "canplay", "playing", "waiting", "timeupdate"] as const;
      for (const name of nativeEvents) this.video.addEventListener(name, read);
      const timer = setInterval(read, 500);
      this.unsubscribeNative = () => {
        clearInterval(timer);
        for (const name of nativeEvents) this.video.removeEventListener(name, read);
        this.seekGeneration++;
      };
      read();
    }
    return () => {
      this.listeners.delete(callback);
      if (!this.listeners.size) {
        this.unsubscribeNative?.();
        this.unsubscribeNative = null;
      }
    };
  }
}
