import { hboMaxPlaybackId } from "@anidachi/protocol";
import { HBO_CLOCK_REPLY, HBO_CLOCK_REQUEST, type HboContentClock } from "./content-clock";

interface Period { type: string; startMs: number; durationMs: number }
interface PlayerControls {
  _rootElement?: Element;
  _lastLoadedContentMetadata?: { videoId?: string; id?: string };
  _playbackEngineAdapter?: {
    _activeLoadContext?: { contentId?: string };
    _activeStreamInfo?: { streamMode?: string; videoPeriods?: Period[] };
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

function nativeClock(video: HTMLVideoElement, target: number | null): HboContentClock | undefined {
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
  if (target !== null && inMain) {
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
        !(target === null || Number.isFinite(target))) return;
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
