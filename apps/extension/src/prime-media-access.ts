import type { RoomMediaKind } from "@anidachi/protocol";

export interface PrimeMediaScope {
  provider: import("./catalog-room-routes").CatalogRoomProvider;
  tabId: number;
  roomId: string;
  participantSessionId: string;
}

export const mediaAccessChannel = "anidachi:prime-media-access:v1";
export const mediaOwnerChannel = "anidachi:prime-media-owner:v1";
export const tilePage = "prime-media-tile.html";
export const permissionPage = "prime-media-permission.html";

export interface PrimeDevicePrompt {
  device: RoomMediaKind;
  ticket: string;
}

export type OwnerAccess =
  | { action: "ticket"; participantId: string }
  | { action: "redeem"; ticket: string }
  | { action: "permission"; ticket: string; documentId: string }
  | { action: "settle"; ticket: string; documentId: string; allowed: boolean };

export interface PrimeTileWindow extends Window {
  bindPrimeRoomTile?: (grant: string, target: HTMLVideoElement) => (() => void) | undefined;
}

export function deviceConstraints(device: RoomMediaKind): MediaStreamConstraints {
  return device === "camera" ? {video: true, audio: false} : {video: false, audio: true};
}

export function sameMediaScope(a: PrimeMediaScope, b: PrimeMediaScope) {
  return a.provider === b.provider && a.tabId === b.tabId && a.roomId === b.roomId && a.participantSessionId === b.participantSessionId;
}
