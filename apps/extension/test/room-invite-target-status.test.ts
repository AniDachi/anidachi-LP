import type { RoomInvite } from "@anidachi/protocol";
import { describe, expect, it } from "vitest";
import {
	mergeRoomInviteTargetStatus,
	roomInviteGroupStatus,
	roomInviteTargetStatuses,
	roomInviteTargetStatusLabel,
} from "../src/room-invite-target-status";

const ROOM_ID = "room-1";
const FRIEND_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";

describe("room invite target status", () => {
	it("restores pending and accepted target state from canonical sent invites", () => {
		const statuses = roomInviteTargetStatuses(
			[
				invite("direct", "accepted"),
				invite("group", "pending"),
				{ ...invite("direct", "pending"), roomId: "another-room" },
			],
			ROOM_ID,
		);

		expect(statuses.get(`friend:${FRIEND_ID}`)?.state).toBe("accepted");
		expect(statuses.get(`group:${GROUP_ID}`)?.state).toBe("pending");
	});

	it.each([
		"declined",
		"expired",
	] as const)("keeps the canonical %s status instead of collapsing it to invited", (recipientStatus) => {
		const statuses = roomInviteTargetStatuses(
			[invite("direct", recipientStatus)],
			ROOM_ID,
		);

		const targetStatus = requireValue(
			statuses.get(`friend:${FRIEND_ID}`),
			"friend status",
		);
		expect(targetStatus.state).toBe(recipientStatus);
		expect(roomInviteTargetStatusLabel(targetStatus)).toBe(
			recipientStatus === "declined" ? "Declined" : "Expired",
		);
	});

	it("projects group recipients into friend rows and summarizes mixed group state", () => {
		const SECOND_FRIEND_ID = "55555555-5555-4555-8555-555555555555";
		const acceptedRecipient = requireValue(
			invite("group", "accepted").recipients[0],
			"accepted recipient",
		);
		const pendingRecipient = requireValue(
			invite("group", "pending").recipients[0],
			"pending recipient",
		);
		const groupInvite = {
			...invite("group", "accepted"),
			recipients: [
				acceptedRecipient,
				{
					...pendingRecipient,
					user: {
						...pendingRecipient.user,
						userId: SECOND_FRIEND_ID,
						displayName: "Second friend",
					},
				},
			],
		} satisfies RoomInvite;

		const statuses = roomInviteTargetStatuses([groupInvite], ROOM_ID);
		const groupStatus = roomInviteGroupStatus(statuses, [
			FRIEND_ID,
			SECOND_FRIEND_ID,
		]);

		expect(statuses.get(`friend:${FRIEND_ID}`)?.state).toBe("accepted");
		expect(statuses.get(`friend:${SECOND_FRIEND_ID}`)?.state).toBe("pending");
		expect(groupStatus?.state).toBe("mixed");
		expect(
			roomInviteTargetStatusLabel(requireValue(groupStatus, "group status")),
		).toBe("1 accepted · 1 pending");
	});

	it("updates the clicked target immediately from the create response", () => {
		const current = roomInviteTargetStatuses(
			[invite("direct", "declined")],
			ROOM_ID,
		);
		const next = mergeRoomInviteTargetStatus(
			current,
			`friend:${FRIEND_ID}`,
			invite("direct", "pending"),
		);

		expect(next.get(`friend:${FRIEND_ID}`)?.state).toBe("pending");
		expect(current.get(`friend:${FRIEND_ID}`)?.state).toBe("declined");
	});
});

function requireValue<T>(value: T | null | undefined, label: string): T {
	if (value === null || value === undefined) {
		throw new Error(`Missing ${label}`);
	}
	return value;
}

function invite(
	targetKind: "direct" | "group",
	status: RoomInvite["recipients"][number]["status"],
): RoomInvite {
	return {
		id: crypto.randomUUID(),
		roomId: ROOM_ID,
		sender: {
			userId: "33333333-3333-4333-8333-333333333333",
			handle: null,
			displayName: "Host",
			avatarUrl: null,
		},
		targetKind,
		targetGroupId: targetKind === "group" ? GROUP_ID : null,
		message: null,
		roomTitle: null,
		sourceUrl: null,
		videoFingerprint: null,
		createdAt: "2026-08-10T08:00:00.000Z",
		expiresAt: "2026-08-11T08:00:00.000Z",
		recipients: [
			{
				user: {
					userId: FRIEND_ID,
					handle: null,
					displayName: "Friend",
					avatarUrl: null,
				},
				status,
				updatedAt: "2026-08-10T08:00:00.000Z",
				respondedAt: status === "pending" ? null : "2026-08-10T08:01:00.000Z",
			},
		],
	};
}
