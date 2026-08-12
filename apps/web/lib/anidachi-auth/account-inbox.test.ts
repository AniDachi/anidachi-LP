import assert from "node:assert/strict";
import test from "node:test";
import type { AccountInboxItem } from "@anidachi/protocol";
import {
	buildAccountInboxPage,
	buildAccountInboxResponseFromDatabase,
	roomInviteInboxLifecycle,
} from "./account-inbox";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const SENDER_ID = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-08-09T12:00:00.000Z");

test("room invite lifecycle uses durable recipient state", () => {
	assert.deepEqual(
		roomInviteInboxLifecycle({
			recipientStatus: "pending",
			createdAt: "2026-08-09T10:00:00.000Z",
			missedAt: null,
			now: NOW,
		}),
		{ state: "active", missedAt: null, activityAt: "2026-08-09T10:00:00.000Z" },
	);
	assert.deepEqual(
		roomInviteInboxLifecycle({
			recipientStatus: "expired",
			createdAt: "2026-08-09T10:00:00.000Z",
			missedAt: "2026-08-09T11:00:00.000Z",
			now: NOW,
		}),
		{
			state: "missed",
			missedAt: "2026-08-09T11:00:00.000Z",
			activityAt: "2026-08-09T11:00:00.000Z",
		},
	);
});

test("room invite lifecycle keeps the first missed transition stable", () => {
	assert.deepEqual(
		roomInviteInboxLifecycle({
			recipientStatus: "expired",
			createdAt: "2026-08-09T10:00:00.000Z",
			missedAt: "2026-08-09T10:30:00.000Z",
			recipientUpdatedAt: "2026-08-09T11:30:00.000Z",
			now: NOW,
		}),
		{
			state: "missed",
			missedAt: "2026-08-09T10:30:00.000Z",
			activityAt: "2026-08-09T10:30:00.000Z",
		},
	);
});

test("room invite lifecycle omits resolved and old missed items", () => {
	for (const status of ["accepted", "declined"] as const) {
		assert.equal(
			roomInviteInboxLifecycle({
				recipientStatus: status,
				createdAt: "2026-08-09T10:00:00.000Z",
				missedAt: null,
				now: NOW,
			}),
			null,
		);
	}
	assert.equal(
		roomInviteInboxLifecycle({
			recipientStatus: "expired",
			createdAt: "2026-08-08T10:00:00.000Z",
			missedAt: "2026-08-08T11:59:59.999Z",
			now: NOW,
		}),
		null,
	);
});

test("account inbox pagination is stable and counts unseen separately from actionable", () => {
	const items: AccountInboxItem[] = [
		friendRequest(
			"33333333-3333-4333-8333-333333333333",
			"2026-08-09T11:00:00.000Z",
		),
		roomInvite(
			"44444444-4444-4444-8444-444444444444",
			"active",
			"2026-08-09T10:00:00.000Z",
			null,
		),
		roomInvite(
			"55555555-5555-4555-8555-555555555555",
			"missed",
			"2026-08-09T09:00:00.000Z",
			"2026-08-09T09:00:00.000Z",
		),
	];

	const first = buildAccountInboxPage({
		ownerUserId: OWNER_ID,
		items,
		limit: 2,
	});
	assert.deepEqual(first.items.map(itemId), [
		"33333333-3333-4333-8333-333333333333",
		"44444444-4444-4444-8444-444444444444",
	]);
	assert.deepEqual(first.counts, {
		unseen: 2,
		actionable: 2,
		activeRoomInvites: 1,
		pendingFriendRequests: 1,
	});
	assert.ok(first.nextCursor);

	const second = buildAccountInboxPage({
		ownerUserId: OWNER_ID,
		items,
		limit: 2,
		cursor: first.nextCursor,
	});
	assert.deepEqual(second.items.map(itemId), [
		"55555555-5555-4555-8555-555555555555",
	]);
	assert.equal(second.nextCursor, null);
	assert.deepEqual(second.counts, first.counts);
});

test("account inbox rejects malformed pagination cursors", () => {
	assert.throws(
		() =>
			buildAccountInboxPage({
				ownerUserId: OWNER_ID,
				items: [],
				cursor: "not-a-valid-cursor",
			}),
		(error) =>
			error instanceof Error && error.message === "Invalid inbox cursor",
	);
	assert.throws(
		() =>
			buildAccountInboxPage({
				ownerUserId: OWNER_ID,
				items: [],
				cursor: "x".repeat(513),
			}),
		(error) =>
			error instanceof Error && error.message === "Invalid inbox cursor",
	);
});

test("database inbox page maps one consistent snapshot into the shared contract", () => {
	const response = buildAccountInboxResponseFromDatabase({
		ownerUserId: OWNER_ID,
		limit: 1,
		now: NOW,
		value: {
			entries: [
				inboxDatabaseRow({
					item_kind: "room-invite",
					item_state: "active",
					item_id: "44444444-4444-4444-8444-444444444444",
					room_id: "room-1",
					target_kind: "direct",
				}),
				inboxDatabaseRow({
					item_kind: "friend-request",
					item_state: "pending",
					item_id: "55555555-5555-4555-8555-555555555555",
					room_id: null,
					target_kind: null,
				}),
			],
			counts: {
				unseen_count: "2",
				actionable_count: 2,
				active_room_invite_count: 1,
				pending_friend_request_count: 1,
			},
		},
	});

	assert.equal(response.meta.ownerUserId, OWNER_ID);
	assert.equal(response.items.length, 1);
	assert.equal(response.items[0]?.kind, "room-invite");
	assert.deepEqual(response.counts, {
		unseen: 2,
		actionable: 2,
		activeRoomInvites: 1,
		pendingFriendRequests: 1,
	});
	assert.ok(response.nextCursor);
});

test("database inbox page rejects unknown lifecycle values and incomplete counts", () => {
	const counts = {
		unseen_count: 1,
		actionable_count: 1,
		active_room_invite_count: 1,
		pending_friend_request_count: 0,
	};

	assert.throws(() =>
		buildAccountInboxResponseFromDatabase({
			ownerUserId: OWNER_ID,
			limit: 50,
			now: NOW,
			value: {
				entries: [inboxDatabaseRow({ item_kind: "unknown" })],
				counts,
			},
		}),
	);
	assert.throws(() =>
		buildAccountInboxResponseFromDatabase({
			ownerUserId: OWNER_ID,
			limit: 50,
			now: NOW,
			value: {
				entries: [],
				counts: { ...counts, unseen_count: undefined },
			},
		}),
	);
});

function sender() {
	return {
		userId: SENDER_ID,
		handle: "ren",
		displayName: "Ren",
		avatarUrl: null,
	};
}

function friendRequest(
	friendshipId: string,
	activityAt: string,
): AccountInboxItem {
	return {
		kind: "friend-request",
		friendshipId,
		sender: sender(),
		state: "pending",
		createdAt: activityAt,
		activityAt,
		seenAt: null,
	};
}

function roomInvite(
	inviteId: string,
	state: "active" | "missed",
	activityAt: string,
	missedAt: string | null,
): AccountInboxItem {
	const common = {
		kind: "room-invite" as const,
		inviteId,
		roomId: `room-${inviteId}`,
		sender: sender(),
		targetKind: "direct" as const,
		targetGroupId: null,
		targetGroupName: null,
		message: null,
		roomTitle: null,
		sourceUrl: null,
		videoFingerprint: null,
		createdAt: activityAt,
		activityAt,
		seenAt: state === "missed" ? activityAt : null,
	};
	if (state === "active") {
		return { ...common, state: "active", missedAt: null };
	}
	if (!missedAt) throw new Error("Missed inbox fixtures require missedAt");
	return { ...common, state: "missed", missedAt };
}

function itemId(item: AccountInboxItem): string {
	return item.kind === "room-invite" ? item.inviteId : item.friendshipId;
}

function inboxDatabaseRow(overrides: Record<string, unknown> = {}) {
	return {
		item_kind: "room-invite",
		item_id: "44444444-4444-4444-8444-444444444444",
		item_state: "active",
		activity_at: "2026-08-09T11:00:00.000Z",
		created_at: "2026-08-09T10:00:00.000Z",
		seen_at: null,
		missed_at: null,
		sender_user_id: SENDER_ID,
		sender_handle: "ren",
		sender_display_name: "Ren",
		sender_avatar_url: null,
		room_id: "room-1",
		target_kind: "direct",
		target_group_id: null,
		target_group_name: null,
		message: null,
		room_title: "One-Punch Man",
		source_url: "https://www.youtube.com/watch?v=abcdefghijk",
		video_fingerprint: "youtube:abcdefghijk",
		...overrides,
	};
}
