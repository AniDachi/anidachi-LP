import { isSameExtensionAuthSession, normalizeExtensionAuthTokens } from "./auth-tokens";

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
  authRevision?: string | null;
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
    input.ownerUserId !== null;
  const restoredRoomActive = input.ownerUserId !== null &&
    input.storedRoomSessionOwnerUserId === input.ownerUserId;
  return {
    ready,
    roomSuppressed: input.roomActive || restoredRoomActive,
  };
}

export function shouldRefreshWatchHistoryAuthority(
  input: WatchHistoryAuthorityRefreshInput,
): boolean {
  return input.controllerAvailable &&
    input.previous !== null &&
    input.next.ownerUserId !== null &&
    input.previous.ownerUserId === input.next.ownerUserId &&
    (input.previous.accessToken !== input.next.accessToken ||
      (input.previous.authRevision ?? null) !== (input.next.authRevision ?? null));
}

/** Storage notification fencing is synchronous, before async identity hydration. */
export function invalidateWatchHistoryOnAuthStorageChange(
  controller: { invalidateCaptureAuthority(): void } | null,
  nextValue: unknown,
  previousValue: unknown,
): void {
  const previous = normalizeExtensionAuthTokens(previousValue);
  const next = normalizeExtensionAuthTokens(nextValue);
  if ((!previous && !next) || (previous && isSameExtensionAuthSession(previous, next))) return;
  controller?.invalidateCaptureAuthority();
}
