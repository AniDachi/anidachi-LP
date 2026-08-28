import type { RoomConnectionStatus } from "./room-client";

interface P2PMediaSessionInput {
  localHasMediaSeat: boolean;
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

interface CameraEnabledForRoomConnectionInput {
  currentCameraEnabled: boolean;
  persistedCameraEnabled: boolean;
  sameRoomReconnect: boolean;
}

export const DEFAULT_LOCAL_CAMERA_ENABLED = false;

export function getCameraEnabledForRoomConnection({
  currentCameraEnabled,
  persistedCameraEnabled,
  sameRoomReconnect,
}: CameraEnabledForRoomConnectionInput): boolean {
  return sameRoomReconnect ? currentCameraEnabled : persistedCameraEnabled;
}

interface PersistRoomSessionForCurrentJoinInput<T> {
  discard: (persistedSession: T) => Promise<void>;
  isCurrentJoin: () => boolean;
  persist: () => Promise<T>;
}

export async function persistRoomSessionForCurrentJoin<T>({
  discard,
  isCurrentJoin,
  persist,
}: PersistRoomSessionForCurrentJoinInput<T>): Promise<T | null> {
  const persistedSession = await persist();
  if (isCurrentJoin()) {
    return persistedSession;
  }

  await discard(persistedSession);
  return null;
}

export function getP2PMediaSessionState({
  localHasMediaSeat,
  participantId,
  roomId,
  roomMediaSeatLimit,
  roomSnapshotReady,
  status,
}: P2PMediaSessionInput): P2PMediaSessionState {
  const roomSessionActive = status !== "idle";
  const p2pSessionActive = Boolean(
    roomSessionActive && roomId && participantId && roomMediaSeatLimit > 0 && localHasMediaSeat,
  );
  const p2pReady = Boolean(p2pSessionActive && status === "connected" && roomSnapshotReady);

  return { p2pReady, p2pSessionActive };
}
