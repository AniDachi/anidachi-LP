import type {
  P2PSignal,
  VoiceMode as ProtocolVoiceMode,
} from "@anidachi/protocol";

export interface GhostVideo {
  participantId: string;
  element: HTMLVideoElement;
  local: boolean;
}

export type VoiceMode = ProtocolVoiceMode;

export type MicrophoneStatus = "off" | "connecting" | "on" | "error";

export type MicrophoneTerminalFailureReason =
  | "constraints"
  | "device-not-found"
  | "permission-denied"
  | "recovery-exhausted"
  | "security";

export interface MicrophoneTerminalFailure {
  errorName: string | null;
  message: string;
  reason: MicrophoneTerminalFailureReason;
}

export interface MicrophoneIntent {
  mode: VoiceMode;
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

  return intent.mode === "open-mic" || intent.pushToTalkHeld;
}

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
