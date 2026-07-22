import type { PlaybackState } from "@anidachi/protocol";

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
  duckVolume(targetVolume?: number): () => void;
  isFullscreen(): boolean;
  enterFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
}

export interface SeekOptions {
  resumeIfPlaying?: boolean;
}
