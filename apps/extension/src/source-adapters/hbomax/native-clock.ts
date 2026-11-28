import { hboMaxPlaybackId } from "@anidachi/protocol";
import { HBO_CLOCK_REPLY, HBO_CLOCK_REQUEST, type HboContentClock } from "./content-clock";

interface Period { type: string; startMs: number; durationMs: number }
interface NativeEpisode { videoId?: string; videoType?: string; showId?: string }
interface UpNext {
  _videoId?: string;
  _contentMetadata?: { id?: string };
  upNextContentMetaData?: NativeEpisode;
}
interface PlayerControls {
  _rootElement?: Element;
  _overlayCoordinator?: { _overlays?: { id?: string; _controller?: { adaptors?: Map<string, UpNext> } }[] };
  _lastLoadedContentMetadata?: {
    videoId?: string; id?: string; videoType?: string; showId?: string;
    title?: string; subtitle?: string; seasonNumber?: number; episodeNumber?: number;
  };
  _playbackEngineAdapter?: {
    _activeLoadContext?: { contentId?: string };
    _activeStreamInfo?: { streamMode?: string; videoPeriods?: Period[]; videoAboutToEndMs?: number };
    _timelineManager?: {
      _videoElement?: HTMLVideoElement;
      _isInitialized?: boolean;
      getPlayheadData(ms: number): { contentPlayheadMs: number };
      getStreamPlayhead(ms: number): number;
    };
  };
}
interface Fiber {
  return?: Fiber;
  memoizedProps?: { playerCallbacks?: { mediator?: { _playerControls?: PlayerControls } } };
}

function controlsFor(video: HTMLVideoElement): PlayerControls | undefined {
  const anchor = video.parentElement?.querySelector('[data-testid="player-ux-skip-button"], [data-testid="overlay-root"], #overlay-root');
  if (!anchor) return;
  const key = Object.keys(anchor).find(name => name.startsWith("__reactFiber$"));
  if (!key) return;
  let fiber: Fiber | undefined = Reflect.get(anchor, key);
  for (let i = 0; fiber && i < 30; i++, fiber = fiber.return) {
    const controls = fiber.memoizedProps?.playerCallbacks?.mediator?._playerControls;
    if (controls?._rootElement?.contains(video)) return controls;
  }
}

function nativeClock(video: HTMLVideoElement, target: number | "episode" | "successor" | null): HboContentClock | undefined {
  const id = hboMaxPlaybackId(location.href);
  const controls = controlsFor(video);
  const engine = controls?._playbackEngineAdapter;
  const manager = engine?._timelineManager;
  const stream = engine?._activeStreamInfo;
  const metadata = controls?._lastLoadedContentMetadata;
  if (!id || metadata?.videoId !== id || !manager || manager._isInitialized === false ||
      (manager._videoElement && manager._videoElement !== video) ||
      (engine?._activeLoadContext?.contentId && metadata.id !== engine._activeLoadContext.contentId) ||
      stream?.streamMode !== "VOD" || !Array.isArray(stream.videoPeriods)) return;
  const mains = stream.videoPeriods.filter(period => period.type === "main");
  if (mains.length !== 1) return;
  const main = mains[0]!;
  if (!Number.isFinite(main.startMs) || main.startMs < 0 || !Number.isFinite(main.durationMs) || main.durationMs <= 0) return;
  // HBO's native mapper removes inserted ads. The main period excludes bundled promos.
  const contentMs = manager.getPlayheadData(video.currentTime * 1000).contentPlayheadMs;
  if (!Number.isFinite(contentMs)) return;
  const elapsed = contentMs - main.startMs;
  const duration = main.durationMs / 1000;
  const inMain = elapsed >= 0 && elapsed <= main.durationMs + 50;
  const clock: HboContentClock = { duration, inMain, position: Math.min(duration, Math.max(0, elapsed / 1000)) };
  if (target === "successor" && inMain && metadata.videoType === "EPISODE" && metadata.showId &&
      metadata.id && metadata.id === engine?._activeLoadContext?.contentId) {
    const overlay = controls?._overlayCoordinator?._overlays?.find(item => item.id === "up_next");
    const queue = overlay?._controller?.adaptors?.get("upNext");
    const next = queue?.upNextContentMetaData;
    if (queue?._videoId === id && queue._contentMetadata?.id === metadata.id && next?.videoType === "EPISODE" &&
        next.showId === metadata.showId && next.videoId && next.videoId !== id) {
      const marker = stream.videoAboutToEndMs;
      const credits = typeof marker === "number" ? (marker - main.startMs) / 1000 : NaN;
      clock.successor = { videoId: next.videoId, creditsStart: credits > 0 && credits <= duration ? credits : duration };
    }
  }
  // HBO can advance past the last episode in its cached catalog without fetching another player page.
  if (target === "episode" && inMain && metadata.id && metadata.id === engine?._activeLoadContext?.contentId &&
      metadata.videoType === "EPISODE" && metadata.showId && metadata.title && metadata.subtitle &&
      metadata.seasonNumber && metadata.episodeNumber) {
    clock.episode = {
      identity: { kind: "episode", providerSeriesId: metadata.showId, providerEpisodeIdentifier: id },
      title: metadata.title, episodeTitle: metadata.subtitle, displayTitle: metadata.title + " — " + metadata.subtitle,
      seasonNumber: metadata.seasonNumber, episodeNumber: metadata.episodeNumber, seasonTitle: null, artworkUrl: null,
    };
  }
  if (typeof target === "number" && inMain) {
    const ms = main.startMs + Math.min(main.durationMs, Math.max(0, target * 1000));
    const media = manager.getStreamPlayhead(ms);
    if (Number.isFinite(media) && media >= 0 && media <= video.duration * 1000 + 50 &&
        Math.abs(manager.getPlayheadData(media).contentPlayheadMs - ms) <= 100) {
      clock.streamTarget = Math.min(video.duration, media / 1000);
    }
  }
  return clock;
}

export function startHboClock(doc: Document) {
  const handle = (event: Event) => {
    const video = event.target;
    const target = (event as CustomEvent).detail;
    if (!(video instanceof HTMLVideoElement) || !video.matches('[data-testid="playerContainer"] > video[data-testid="VideoElement"]') ||
        !(target === null || target === "episode" || target === "successor" || Number.isFinite(target))) return;
    try {
      const clock = nativeClock(video, target);
      if (clock) video.dispatchEvent(new CustomEvent(HBO_CLOCK_REPLY, { detail: clock }));
    } catch {
      // During a player replacement the old SDK can stop answering before the video detaches.
    }
  };
  doc.addEventListener(HBO_CLOCK_REQUEST, handle, true);
  return () => doc.removeEventListener(HBO_CLOCK_REQUEST, handle, true);
}
