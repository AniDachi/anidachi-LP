export type WatchHistoryRuntimeGateInput = {
  identityLoaded: boolean;
  ownerUserId: string | null;
  roomSessionLoadedForUserId: string | null | undefined;
  storedRoomSessionOwnerUserId: string | null;
  roomActive: boolean;
};

export type WatchHistoryRuntimeGate = {
  ready: boolean;
  roomSuppressed: boolean;
};

export function resolveWatchHistoryRuntimeGate(
  input: WatchHistoryRuntimeGateInput,
): WatchHistoryRuntimeGate {
  const ready = input.identityLoaded &&
    input.roomSessionLoadedForUserId === input.ownerUserId;
  const restoredRoomActive = input.ownerUserId !== null &&
    input.storedRoomSessionOwnerUserId === input.ownerUserId;
  return {
    ready,
    roomSuppressed: !ready || input.roomActive || restoredRoomActive,
  };
}
