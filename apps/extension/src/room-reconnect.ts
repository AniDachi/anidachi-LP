const ROOM_RECONNECT_BASE_DELAY_MS = 900;
const ROOM_RECONNECT_MAX_DELAY_MS = 8000;

export function getRoomReconnectDelayMs(attempt: number): number {
  const normalizedAttempt = Math.max(1, Math.floor(attempt));
  return Math.min(
    ROOM_RECONNECT_MAX_DELAY_MS,
    ROOM_RECONNECT_BASE_DELAY_MS * 2 ** (normalizedAttempt - 1),
  );
}
