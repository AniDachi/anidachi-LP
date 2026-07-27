import type { P2PSignal } from "@anidachi/protocol";

export interface GhostVideo {
  participantId: string;
  element: HTMLVideoElement;
  local: boolean;
}

export type VoiceMode = "push-to-talk" | "open-mic";

export type MicrophoneStatus = "off" | "connecting" | "on" | "error";

export interface MicrophoneIntent {
  mode: VoiceMode;
  openMicEnabled: boolean;
  pushToTalkHeld: boolean;
}

export function shouldPublishMicrophone(
  intent: MicrophoneIntent,
  context: {
    roomActive: boolean;
    hasMediaSeat: boolean;
  },
): boolean {
  if (!context.roomActive || !context.hasMediaSeat) {
    return false;
  }

  return intent.mode === "open-mic"
    ? intent.openMicEnabled
    : intent.pushToTalkHeld;
}

export type LiveVoiceStatus = "idle" | "connecting" | "talking" | "error";

export type RoomSendDisposition = "sent" | "queued" | "dropped";

export interface SignalingTransportReady {
  senderConnectionId: string;
  reconnect: boolean;
  forceMediaResync?: boolean;
}

export interface IncomingP2PSignal {
  clientSignalId: string;
  fromUserId: string;
  roomGeneration?: number;
  sequence: number;
  senderConnectionId: string;
  senderMediaSessionId?: string;
  serverSeq?: number;
  signal: P2PSignal;
  sourceGeneration?: number;
}
