import type { PlaybackState, WatchSourceDescriptor } from "@anidachi/protocol";
import type {
  PlayerOverlayGeometry,
  PlayerOverlayGeometryListener,
} from "./overlay-geometry";

export type SourceProvider = WatchSourceDescriptor["provider"];

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
