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

export type WatchHistoryAuthContext = {
  ownerUserId: string | null;
  accessToken: string | null;
};

export type WatchHistoryAuthorityRefreshInput = {
  previous: WatchHistoryAuthContext | null;
  next: WatchHistoryAuthContext;
  controllerAvailable: boolean;
};

export function resolveWatchHistoryRuntimeGate(
  input: WatchHistoryRuntimeGateInput,
): WatchHistoryRuntimeGate {
  const ready = input.identityLoaded &&
    input.ownerUserId !== null &&
    input.roomSessionLoadedForUserId === input.ownerUserId;
  const restoredRoomActive = input.ownerUserId !== null &&
    input.storedRoomSessionOwnerUserId === input.ownerUserId;
  return {
    ready,
    roomSuppressed: !ready || input.roomActive || restoredRoomActive,
  };
}

export function shouldRefreshWatchHistoryAuthority(
  input: WatchHistoryAuthorityRefreshInput,
): boolean {
  return input.controllerAvailable &&
    input.previous !== null &&
    input.next.ownerUserId !== null &&
    input.previous.ownerUserId === input.next.ownerUserId &&
    input.previous.accessToken !== input.next.accessToken;
}
