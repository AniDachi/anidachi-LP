import {
	ActiveRoomRecoveryRequestSchema,
	MAX_PARTICIPANT_ID_CHARS,
	RoomDepartureRequestSchema,
} from "@anidachi/protocol";
import { departPersistedRoomSession } from "./room-departure-retry";
import {
	clearRoomSessionForDepartureIfMatch,
	loadRoomSessionForExactDeparture,
	roomSessionIdentityMatches,
	type RoomSessionRecord,
} from "./room-session-storage";
export const PLAYER_ROOM_DEPARTURE = "ANIDACHI_PLAYER_ROOM_DEPARTURE";
type Message = {
	type: string;
	roomId: string;
	ownerUserId: string;
	participantSessionId: string;
};
type Dependencies = {
	load?: (tab: number, message: Message) => Promise<RoomSessionRecord | null>;
	depart?: (record: RoomSessionRecord) => Promise<unknown>;
	clear?: (tab: number, record: RoomSessionRecord) => Promise<boolean>;
};
export function isPlayerRoomDeparture(value: unknown): value is Message {
	if (!value || typeof value !== "object") return false;
	const m = value as Message;
	return (
		Object.keys(m).length === 4 &&
		m.type === PLAYER_ROOM_DEPARTURE &&
		typeof m.ownerUserId === "string" &&
		m.ownerUserId.length > 0 &&
		m.ownerUserId.length <= MAX_PARTICIPANT_ID_CHARS &&
		ActiveRoomRecoveryRequestSchema.safeParse({ roomId: m.roomId }).success &&
		RoomDepartureRequestSchema.safeParse({
			participantSessionId: m.participantSessionId,
		}).success
	);
}
export async function requestPlayerRoomDeparture(
	record: RoomSessionRecord,
): Promise<void> {
	const result = await chrome.runtime.sendMessage({
		type: PLAYER_ROOM_DEPARTURE,
		roomId: record.roomId,
		ownerUserId: record.ownerUserId,
		participantSessionId: record.participantSessionId,
	});
	if (result?.ok !== true)
		throw new Error(
			"Could not finish leaving the room. Please reopen the player and try again.",
		);
}
/** Terminal local exit. A successful response means server acknowledgement OR
 * exact durable retry ownership; it does not pretend an offline server replied. */
export async function handlePlayerRoomDeparture(
	message: Message,
	sender: { tab?: { id?: number } },
	dependencies: Dependencies = {},
) {
	const tab = sender.tab?.id;
	if (!Number.isInteger(tab) || tab! < 0 || !isPlayerRoomDeparture(message))
		return { ok: false };
	try {
		const record = await (
			dependencies.load ?? loadRoomSessionForExactDeparture
		)(tab!, message);
		if (
			!record ||
			!roomSessionIdentityMatches(record, { ...message, version: 1 })
		)
			return { ok: false };
		// Existing persisted cleanup verifies account ownership when sending and retries
		// only this participant session. A delayed exit cannot close a newer session.
		const outcome = await (dependencies.depart ?? departPersistedRoomSession)(
			record,
		);
		if (outcome === "active-room-changed" || outcome === "account-changed")
			return { ok: false };
		await (dependencies.clear ?? clearRoomSessionForDepartureIfMatch)(
			tab!,
			record,
		);
		return { ok: true };
	} catch {
		return { ok: false };
	}
}
