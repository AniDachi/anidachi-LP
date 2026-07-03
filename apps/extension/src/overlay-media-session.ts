import type { RoomConnectionStatus } from "./room-client";

interface P2PMediaSessionInput {
  participantId: string | null;
  roomId: string | null;
  roomMediaSeatLimit: number;
  roomSnapshotReady: boolean;
  status: RoomConnectionStatus;
}

interface P2PMediaSessionState {
  p2pReady: boolean;
  p2pSessionActive: boolean;
}

export function getP2PMediaSessionState({
  participantId,
  roomId,
  roomMediaSeatLimit,
  roomSnapshotReady,
  status,
}: P2PMediaSessionInput): P2PMediaSessionState {
  const roomSessionActive = status !== "idle";
  const p2pSessionActive = Boolean(
    roomSessionActive && roomId && participantId && roomMediaSeatLimit > 0,
  );
  const p2pReady = Boolean(
    p2pSessionActive && status === "connected" && roomSnapshotReady,
  );

  return { p2pReady, p2pSessionActive };
}
