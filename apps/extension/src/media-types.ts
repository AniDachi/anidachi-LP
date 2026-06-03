import type { P2PSignal } from "@anidachi/protocol";

export interface GhostVideo {
  participantId: string;
  element: HTMLVideoElement;
  local: boolean;
}

export type LiveVoiceStatus = "idle" | "connecting" | "talking" | "error";

export type MediaTransportName = "livekit" | "p2p";

export interface IncomingP2PSignal {
  fromUserId: string;
  sequence: number;
  signal: P2PSignal;
}
