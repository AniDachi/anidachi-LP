import type {
	ClientEvent,
	RoomHistoryAuthority,
	ServerEvent,
} from "@anidachi/protocol";
import type { RoomClientOptions, RoomConnectionStatus } from "./room-client";
import type { RoomMediaRebindState } from "./room-media-session";
import type { RoomSessionRecord } from "./room-session-storage";
import type { SignalingTransportReady } from "./media-types";
import type { RoomHostingTimeScope } from "./room-hosting-time";

export const PRIME_ROOM_UI = "ANIDACHI_PRIME_ROOM_UI";
export const PRIME_ROOM_INTERNAL = "ANIDACHI_PRIME_ROOM_INTERNAL";
export const PRIME_ROOM_DOCUMENT_HANDOFF_MS = 30_000;
export const PRIME_ROOM_PORT = "ANIDACHI_PRIME_ROOM_PORT";
export const PRIME_ROOM_PAGE = "prime-room.html";
export type BrowseBaseline = { fingerprint?: string; visit?: string; followFirstPlay?: boolean };
export type PrimeRoomIdentity = Pick<
	RoomSessionRecord,
	"ownerUserId" | "participantSessionId" | "roomId"
>;
export type LivePrimeRoomSession = RoomSessionRecord & {
	browsingBaseline: BrowseBaseline | null;
	privilegedRoomAuthority?:
		| import("./privileged-overlay-intent").PrivilegedOverlayContext
		| null;
};
export function samePrimeRoom(
	a: PrimeRoomIdentity | null,
	b: PrimeRoomIdentity | null | undefined,
) {
	return (
		!!a &&
		!!b &&
		a.ownerUserId === b.ownerUserId &&
		a.participantSessionId === b.participantSessionId &&
		a.roomId === b.roomId
	);
}

export type PrimeConnect = Pick<
	RoomClientOptions,
	| "roomToken"
	| "participant"
	| "participantSessionId"
	| "roomId"
	| "admissionHandoff"
	| "lastSeenP2PServerSeq"
	| "videoFingerprint"
	| "reconnect"
>;
export type PrimeRoomCommand =
	| { kind: "connect"; ticket: string; options: PrimeConnect }
	| { kind: "send"; event: ClientEvent }
	| { kind: "close" }
	| { kind: "baseline"; value: BrowseBaseline | null }
	| { kind: "media"; value: unknown };
export type PrimeRoomNotification =
	| { kind: "hosting-time-resume"; scope: RoomHostingTimeScope }
	| { kind: "status"; status: RoomConnectionStatus }
	| {
			kind: "chat-history";
			reaction: Extract<ServerEvent, { type: "REACTION" }>["reaction"];
	  }
	| { kind: "event"; event: ServerEvent; mediaState?: RoomMediaRebindState }
	| { kind: "media-state"; state: RoomMediaRebindState }
	| { kind: "authority"; authority: RoomHistoryAuthority | null }
	| { kind: "ready"; ready: SignalingTransportReady }
	| { kind: "connection"; id: string }
	| { kind: "terminal"; code: number }
	| { kind: "media"; value: unknown };
