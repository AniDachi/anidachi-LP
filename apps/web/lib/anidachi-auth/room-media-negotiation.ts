import { RoomMediaCapabilityLeaseSchema } from "@anidachi/protocol";

/** Missing header is the retained legacy client; unknown advertised versions fail closed. */
export function clientMediaProtocolVersion(
	header: string | null,
): 1 | 2 | 3 | null {
	if (header === null) return 1;
	return header === "2" ? 2 : header === "3" ? 3 : null;
}

/** The durable lease pins the room contract. Client support never grants capacity. */
export function supportsRoomMediaProtocol(
	client: number | null,
	room: number,
): boolean {
	return room === 3
		? client === 3
		: room === 2 && (client === 2 || client === 3);
}

/** Check before any active-session mutation, including malformed/future leases. */
export function negotiateRoomMediaLease(value: unknown, client: number | null) {
	if (client === null || ![1, 2, 3].includes(client))
		throw new Error("ROOM_UPDATE_REQUIRED");
	if (value == null) return undefined;
	const lease = RoomMediaCapabilityLeaseSchema.safeParse(value);
	if (
		!lease.success ||
		!supportsRoomMediaProtocol(
			client,
			lease.data.capabilities.mediaProtocolVersion,
		)
	)
		throw new Error("ROOM_UPDATE_REQUIRED");
	return lease.data;
}
