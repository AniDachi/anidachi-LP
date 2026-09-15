/** Window postMessage handshake with www.anidachi.app install/room pages. */
export const ANIDACHI_EXTENSION_PING = "ANIDACHI_EXTENSION_PING";
export const ANIDACHI_EXTENSION_PRESENT = "ANIDACHI_EXTENSION_PRESENT";

export function isAnidachiExtensionPing(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data as { type?: unknown }).type === ANIDACHI_EXTENSION_PING
  );
}
