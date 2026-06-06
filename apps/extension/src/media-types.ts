import type { P2PSignal } from "@anidachi/protocol";

export interface GhostVideo {
  participantId: string;
  element: HTMLVideoElement;
  local: boolean;
}

export type LiveVoiceStatus = "idle" | "connecting" | "talking" | "error";

export type MediaTransportName = "livekit" | "p2p";

export interface IncomingP2PSignal {
  clientSignalId: string;
  fromUserId: string;
  roomGeneration?: number;
  sequence: number;
  senderConnectionId: string;
  serverSeq?: number;
  signal: P2PSignal;
  sourceGeneration?: number;
}
