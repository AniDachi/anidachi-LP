import {
	RoomMediaCapabilityLeaseSchema,
	type RoomMediaCapabilityLease,
} from "@anidachi/protocol";
import {
	getRoomById,
	renewRoomMediaLease,
	roomCapabilitiesFromRoom,
	type RoomRow,
} from "./db";
import { signRoomToken } from "./jwt";
import { getHostQuotaView } from "./room-usage";
/** Durable room record, never caller/JWT plan, freezes the room authority. */
export function roomMediaLease(
	room: RoomRow,
): RoomMediaCapabilityLease | undefined {
	return room.media_lease == null
		? undefined
		: RoomMediaCapabilityLeaseSchema.parse(room.media_lease);
}
export async function issueRoomPolicy(roomId: string) {
	const result = await renewRoomMediaLease(roomId);
	const room = await getRoomById(roomId);
	if (!room || room.status === "ended") throw new Error("ROOM_ENDED");
	if (
		result &&
		typeof result === "object" &&
		"denied" in result &&
		result.denied === true &&
		"closingAt" in result
	) {
		const closingAt = result.closingAt;
		if (
			typeof closingAt !== "string" ||
			!Number.isFinite(Date.parse(closingAt))
		)
			throw new Error("Invalid deadline");
		return { denied: true as const, closingAt };
	}
	const lease = RoomMediaCapabilityLeaseSchema.parse(result);
	const quotaTime=new Date();
 const quota = await getHostQuotaView(
		room.host_user_id,
		room.host_plan_code,
		quotaTime,
	);
	const roomToken = await signRoomToken({
		sub: room.host_user_id,
		roomId,
		role: "host",
		participantSessionId: "internal-capability-renewal",
		capabilities: roomCapabilitiesFromRoom(room),
		mediaLease: lease,
		hostUserId: room.host_user_id,
	});
	return {
		denied: false as const,
		roomToken,
		quota:
			room.host_plan_code === "free"
				? {
						day: quotaTime.toISOString().slice(0, 10),
						remainingSeconds: quota.remainingSeconds,
						resetAt: quota.resetAt,
					}
				: null,
	};
}
