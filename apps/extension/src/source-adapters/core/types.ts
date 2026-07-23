import type { PlaybackState, WatchSourceDescriptor } from "@anidachi/protocol";
import type {
  PlayerOverlayGeometry,
  PlayerOverlayGeometryListener,
} from "./overlay-geometry";

export type SourceProvider = WatchSourceDescriptor["provider"];

export type AdapterPlaybackPhase =
  | "content"
  | "interstitial"
  | "buffering"
  | "transition"
  | "unsupported";

export interface AdapterPlaybackSnapshot {
  phase: AdapterPlaybackPhase;
  contentTime: number;
  playing: boolean;
  playbackRate: number;
  capturedAt: number;
}

export interface AdapterPlaybackPolicy {
  playBeforeMediaReady: boolean;
  readyTimeoutMs: number;
  skipPlayAfterTimeoutWhileSettling: boolean;
  remoteSeekThrottleMs: number;
  remoteSeekTargetToleranceSeconds: number;
  pendingSeekGuard: null | {
    maxAgeMs: number;
    localTargetToleranceSeconds: number;
    remoteTargetToleranceSeconds: number;
  };
  localSeekCoalescing: null | {
    settleDelayMs: number;
    readyDelayMs: number;
    duplicateWindowMs: number;
    targetToleranceSeconds: number;
    suppressPlaybackAfterSeekMs: number;
  };
  hostBufferingHoldDelayMs: number;
}

export interface AdapterOverlayBinding {
  mountTarget: HTMLElement;
  fillMountTarget: boolean;
  useNativePlayerDoubleClick: boolean;
}

export type PlayerEvent =
  | { type: "play"; time: number }
  | { type: "pause"; time: number }
  | { type: "seek"; time: number }
  | { type: "timeupdate"; time: number }
  | { type: "ratechange"; time: number; playbackRate: number }
  | { type: "phasechange"; snapshot: AdapterPlaybackSnapshot };

export interface VideoAdapter {
  id: string;
  provider: SourceProvider;
  name: string;
  video: HTMLVideoElement;
  container: HTMLElement;
  playbackPolicy: AdapterPlaybackPolicy;
  getTitle(): string | null;
  getFingerprint(): string;
  getCurrentTime(): number;
  getState(): PlaybackState;
  getSourceDescriptor(): WatchSourceDescriptor | undefined;
  getPlaybackSnapshot(): AdapterPlaybackSnapshot;
  getOverlayBinding(): AdapterOverlayBinding;
  setPlaybackRate(rate: number): void;
  play(): Promise<void>;
  pause(): void;
  seek(time: number, options?: SeekOptions): void;
  subscribe(callback: (event: PlayerEvent) => void): () => void;
  getOverlayGeometry(): PlayerOverlayGeometry;
  subscribeOverlayGeometry(listener: PlayerOverlayGeometryListener): () => void;
  duckVolume(targetVolume?: number): () => void;
  isFullscreen(): boolean;
  enterFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
}

export interface SeekOptions {
  resumeIfPlaying?: boolean;
}

export type AdapterDetectionResult =
  | { status: "ready"; adapter: VideoAdapter }
  | { status: "waiting"; provider: SourceProvider }
  | { status: "blocked"; provider: SourceProvider }
  | { status: "none" };

export interface SourceAdapterDefinition {
  readonly id: string;
  readonly provider: SourceProvider;
  readonly priority: number;
  detect(video: HTMLVideoElement): VideoAdapter | null;
}
