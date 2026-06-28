import { WEB_HTTP_BASE } from "./constants";

export function buildRoomShareableUrl(roomId: string, baseUrl: string = WEB_HTTP_BASE): string {
  return new URL(`/room/${encodeURIComponent(roomId)}`, baseUrl).toString();
}
