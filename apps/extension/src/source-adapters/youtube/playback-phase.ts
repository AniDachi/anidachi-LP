import type { AdapterPlaybackSnapshot } from "../core/types";

const INTERSTITIAL_EXIT_GRACE_MS = 500;
const HAVE_NOTHING = 0;
const HAVE_FUTURE_DATA = 3;
const MEDIA_EVENTS = [
  "loadstart",
  "loadedmetadata",
  "emptied",
  "waiting",
  "stalled",
  "canplay",
  "playing",
] as const;
const WEAK_AD_MARKERS = [
  ".ytp-ad-module",
  ".video-ads",
  ".ytp-ad-player-overlay",
  ".ytp-ad-text",
  ".ytp-ad-preview-container",
  ".ytp-ad-skip-button-container",
] as const;
const AD_CONTAINER_SELECTOR = [
  ".ytp-ad-module",
  ".video-ads",
  ".ytp-ad-player-overlay",
].join(",");

export interface YouTubePlaybackPhaseTrackerOptions {
  video: HTMLVideoElement;
  player: HTMLElement;
  expectedVideoId: string | null;
  getCurrentVideoId: () => string | null;
  now?: () => number;
}

export class YouTubePlaybackPhaseTracker {
  private readonly video: HTMLVideoElement;
  private readonly player: HTMLElement;
  private readonly expectedVideoId: string | null;
  private readonly getCurrentVideoId: () => string | null;
  private readonly now: () => number;
  private interstitialActive = false;
  private lastInterstitialSignalAt = Number.NEGATIVE_INFINITY;
  private waiting = false;
  private lastContentTime = 0;
  private lastContentPlaying = false;
  private lastContentPlaybackRate = 1;

  constructor(options: YouTubePlaybackPhaseTrackerOptions) {
    this.video = options.video;
    this.player = options.player;
    this.expectedVideoId = options.expectedVideoId;
    this.getCurrentVideoId = options.getCurrentVideoId;
    this.now = options.now ?? Date.now;
  }

  getSnapshot(): AdapterPlaybackSnapshot {
    const capturedAt = this.now();
    const interstitial = this.readInterstitial(capturedAt);
    const phase = this.classify(interstitial);

    if (phase === "content" || phase === "buffering") {
      this.lastContentTime = finiteNonNegative(this.video.currentTime, this.lastContentTime);
      this.lastContentPlaying = !this.video.paused;
      this.lastContentPlaybackRate = positiveFinite(this.video.playbackRate, 1);
    }

    return {
      phase,
      contentTime: this.lastContentTime,
      playing: this.lastContentPlaying,
      playbackRate: this.lastContentPlaybackRate,
      capturedAt,
    };
  }

  subscribe(listener: (snapshot: AdapterPlaybackSnapshot) => void): () => void {
    let disposed = false;
    let exitTimer: number | undefined;
    let lastSignature: string | null = null;
    const observedAdContainers = new WeakSet<Element>();

    const emitIfChanged = () => {
      if (disposed) {
        return;
      }
      const snapshot = this.getSnapshot();
      const signature = snapshotSignature(snapshot);
      if (signature !== lastSignature) {
        lastSignature = signature;
        listener(snapshot);
      }
    };

    const scheduleInterstitialExit = () => {
      if (exitTimer !== undefined) {
        window.clearTimeout(exitTimer);
        exitTimer = undefined;
      }
      if (!this.interstitialActive || this.hasVisibleAdSignal()) {
        return;
      }
      const remaining =
        INTERSTITIAL_EXIT_GRACE_MS - (this.now() - this.lastInterstitialSignalAt);
      exitTimer = window.setTimeout(
        () => {
          exitTimer = undefined;
          emitIfChanged();
        },
        Math.max(0, remaining) + 1,
      );
    };

    const observeAdContainers = (observer: MutationObserver) => {
      for (const container of this.player.querySelectorAll(AD_CONTAINER_SELECTOR)) {
        if (observedAdContainers.has(container)) {
          continue;
        }
        observedAdContainers.add(container);
        observer.observe(container, { childList: true, subtree: true });
      }
    };

    const observer = new MutationObserver(() => {
      observeAdContainers(observer);
      emitIfChanged();
      scheduleInterstitialExit();
    });
    observer.observe(this.player, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
    });
    observeAdContainers(observer);

    const onMediaEvent = (event: Event) => {
      if (event.type === "waiting" || event.type === "stalled") {
        this.waiting = true;
      } else {
        this.waiting = false;
      }
      emitIfChanged();
      scheduleInterstitialExit();
    };
    for (const eventName of MEDIA_EVENTS) {
      this.video.addEventListener(eventName, onMediaEvent);
    }
    emitIfChanged();

    return () => {
      if (disposed) {
        return;
      }
      disposed = true;
      observer.disconnect();
      if (exitTimer !== undefined) {
        window.clearTimeout(exitTimer);
      }
      for (const eventName of MEDIA_EVENTS) {
        this.video.removeEventListener(eventName, onMediaEvent);
      }
    };
  }

  private classify(interstitial: boolean): AdapterPlaybackSnapshot["phase"] {
    const currentVideoId = this.getCurrentVideoId();
    if (
      !this.expectedVideoId ||
      !currentVideoId ||
      currentVideoId !== this.expectedVideoId ||
      !this.player.contains(this.video)
    ) {
      return "transition";
    }
    if (interstitial) {
      return "interstitial";
    }
    if (this.video.readyState === HAVE_NOTHING) {
      return "transition";
    }
    if (!Number.isFinite(this.video.duration) || this.video.duration <= 0) {
      return "unsupported";
    }
    if (this.waiting || this.video.readyState < HAVE_FUTURE_DATA) {
      return "buffering";
    }
    return "content";
  }

  private readInterstitial(now: number): boolean {
    if (this.hasVisibleAdSignal()) {
      this.interstitialActive = true;
      this.lastInterstitialSignalAt = now;
      return true;
    }
    if (
      this.interstitialActive &&
      now - this.lastInterstitialSignalAt <= INTERSTITIAL_EXIT_GRACE_MS
    ) {
      return true;
    }
    this.interstitialActive = false;
    return false;
  }

  private hasVisibleAdSignal(): boolean {
    if (this.player.classList.contains("ad-showing")) {
      return true;
    }

    const visibleMarkers = new Set<HTMLElement>();
    for (const selector of WEAK_AD_MARKERS) {
      const marker = Array.from(this.player.querySelectorAll<HTMLElement>(selector)).find(
        isVisibleMarker,
      );
      if (marker) {
        visibleMarkers.add(marker);
      }
      if (visibleMarkers.size >= 2) {
        return true;
      }
    }
    return false;
  }
}

function isVisibleMarker(element: HTMLElement): boolean {
  if (
    element.closest("[hidden], [aria-hidden='true']") ||
    element.style.display === "none" ||
    element.style.visibility === "hidden"
  ) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function finiteNonNegative(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function positiveFinite(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function snapshotSignature(snapshot: AdapterPlaybackSnapshot): string {
  return [
    snapshot.phase,
    snapshot.contentTime,
    snapshot.playing,
    snapshot.playbackRate,
  ].join("|");
}
