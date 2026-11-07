import type { RoomInviteTargetStatus } from "./room-invite-target-status";
import { roomInviteEligibleRecipientIds } from "./room-invite-target-status";

export type CapsuleInviteState =
	| "idle"
	| "sending"
	| "sent"
	| "accepted"
	| "in-room"
	| "declined"
	| "expired"
	| "ended"
	| "error";
export interface CapsuleInviteView {
	state: CapsuleInviteState;
	label: string;
	disabled: boolean;
	detail: string | null;
	inRoomCount: number;
}

// Durable acceptance and live membership are different facts. An accepted
// recipient outside the room can be invited back under the existing contract.
export function capsuleInvitePresentation(input: {
	ids: readonly string[];
	statuses: ReadonlyMap<string, RoomInviteTargetStatus>;
	present: ReadonlySet<string>;
	membershipReady: boolean;
	sending: ReadonlySet<string>;
	failed: boolean;
}): CapsuleInviteView {
	const ids = [...new Set(input.ids)];
	const inRoomCount = input.membershipReady
		? ids.filter((id) => input.present.has(id)).length
		: 0;
	const base = { inRoomCount, detail: null };
	if (!ids.length || !input.membershipReady)
		return { ...base, state: "idle", label: "Invite", disabled: true };
	if (inRoomCount === ids.length)
		return { ...base, state: "in-room", label: "In room", disabled: true };
	if (ids.some((id) => input.sending.has(id)))
		return {
			...base,
			state: "sending",
			label: "Sending invitation",
			disabled: true,
		};
	const statuses = ids
		.filter((id) => !input.present.has(id))
		.map((id) => input.statuses.get(`friend:${id}`)?.recipientStatuses.get(id));
	const eligible = roomInviteEligibleRecipientIds(
		ids,
		input.statuses,
		input.present,
	);
	if (eligible.length) {
		const accepted = statuses.includes("accepted");
		const state = input.failed ? "error" : accepted ? "accepted" : "idle";
		const label = input.failed ? "Retry" : "Invite";
		return {
			...base,
			state,
			label:
				ids.length > 1 && eligible.length < ids.length
					? `${label} ${eligible.length}`
					: label,
			disabled: false,
			detail: input.failed ? "Could not send" : accepted ? "Accepted" : null,
		};
	}
	const state: CapsuleInviteState = statuses.includes("pending")
		? "sent"
		: statuses.every((value) => value === "declined")
			? "declined"
			: statuses.every((value) => value === "expired")
				? "expired"
				: "ended";
	return {
		...base,
		state,
		label: {
			sent: "Sent",
			declined: "Declined",
			expired: "Expired",
			ended: "Ended",
		}[state],
		disabled: true,
	};
}
