export const EMPTY_ROOM_TIMEOUT_MS = 4 * 60 * 60 * 1_000;

const EMPTY_ROOM_EVENT_ID_DOMAIN = "anidachi:empty-room:v1";
const EMPTY_ROOM_EVENT_ID_PATTERN = /^empty_timeout:[a-f0-9]{64}$/;

export async function createEmptyRoomEndEventId(
  roomId: string,
  emptySince: number,
): Promise<string> {
  const input = new TextEncoder().encode(
    `${EMPTY_ROOM_EVENT_ID_DOMAIN}\0${roomId}\0${emptySince}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", input);
  const hex = Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  return `empty_timeout:${hex}`;
}

export function isEmptyRoomEndEventId(value: unknown): value is string {
  return typeof value === "string" && EMPTY_ROOM_EVENT_ID_PATTERN.test(value);
}
