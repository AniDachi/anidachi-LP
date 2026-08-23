import type {
	AccountInboxCounts,
	AccountInboxItem,
	AccountInboxResponse,
} from "@anidachi/protocol";
import { AccountInboxResponseSchema } from "@anidachi/protocol";
import { createOwnedAccountResponseMeta } from "./account-response";
import { db } from "./db";
import { isUuid } from "./social";

const MISSED_RETENTION_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;

type RoomInviteInboxLifecycleInput = {
	recipientStatus: "pending" | "accepted" | "declined" | "expired";
	createdAt: string;
	missedAt: string | null;
	recipientUpdatedAt?: string;
	now?: Date;
};

type RoomInviteInboxLifecycle =
	| { state: "active"; missedAt: null; activityAt: string }
	| { state: "missed"; missedAt: string; activityAt: string };

type InboxCursor = {
	activityAt: string;
	key: string;
};

type AccountInboxEntryRow = {
	item_kind: "room-invite" | "friend-request";
	item_id: string;
	item_state: "active" | "missed" | "pending";
	activity_at: string;
	created_at: string;
	seen_at: string | null;
	missed_at: string | null;
	sender_user_id: string;
	sender_handle: string | null;
	sender_display_name: string;
	sender_avatar_url: string | null;
	room_id: string | null;
	target_kind: "direct" | "group" | null;
	target_group_id: string | null;
	target_group_name: string | null;
	message: string | null;
	room_title: string | null;
	source_url: string | null;
	video_fingerprint: string | null;
};

type AccountInboxCountRow = {
	unseen_count: number | string;
	actionable_count: number | string;
	active_room_invite_count: number | string;
	pending_friend_request_count: number | string;
};

type AccountInboxPageRpcData = {
	entries: AccountInboxEntryRow[];
	counts: AccountInboxCountRow;
};

export class AccountInboxApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

export function roomInviteInboxLifecycle(
	input: RoomInviteInboxLifecycleInput,
): RoomInviteInboxLifecycle | null {
	if (
		input.recipientStatus === "accepted" ||
		input.recipientStatus === "declined"
	) {
		return null;
	}

	if (input.recipientStatus === "pending") {
		return {
			state: "active",
			missedAt: null,
			activityAt: input.createdAt,
		};
	}

	const nowMs = (input.now ?? new Date()).getTime();
	const missedAt = input.missedAt ?? input.recipientUpdatedAt;
	if (!missedAt) return null;
	if (!Number.isFinite(Date.parse(missedAt))) return null;
	if (nowMs - Date.parse(missedAt) > MISSED_RETENTION_MS) return null;

	return {
		state: "missed",
		missedAt,
		activityAt: missedAt,
	};
}

export function buildAccountInboxPage(params: {
	ownerUserId: string;
	items: readonly AccountInboxItem[];
	cursor?: string | null;
	limit?: number;
	now?: Date;
}): AccountInboxResponse {
	const now = params.now ?? new Date();
	const limit = Math.min(
		MAX_PAGE_LIMIT,
		Math.max(1, params.limit ?? DEFAULT_PAGE_LIMIT),
	);
	const sorted = [...params.items].sort(compareInboxItems);
	const counts = countInboxItems(sorted);
	const cursor = params.cursor ? decodeInboxCursor(params.cursor) : null;
	const afterCursor = cursor
		? sorted.filter((item) => compareInboxItemToCursor(item, cursor) > 0)
		: sorted;
	const page = afterCursor.slice(0, limit);
	const hasNextPage = afterCursor.length > limit;
	const lastPageItem = page.at(-1);

	return {
		meta: createOwnedAccountResponseMeta(params.ownerUserId, now),
		items: page,
		counts,
		nextCursor:
			hasNextPage && lastPageItem ? encodeInboxCursor(lastPageItem) : null,
	};
}

export async function listAccountInbox(params: {
	ownerUserId: string;
	cursor?: string | null;
	limit?: number;
	now?: Date;
}): Promise<AccountInboxResponse> {
	if (!isUuid(params.ownerUserId)) {
		throw new AccountInboxApiError(400, "Invalid account owner");
	}

	const now = params.now ?? new Date();
	const nowIso = now.toISOString();
	const limit = Math.min(
		MAX_PAGE_LIMIT,
		Math.max(1, params.limit ?? DEFAULT_PAGE_LIMIT),
	);
	let cursor: InboxCursor | null = null;
	try {
		cursor = params.cursor ? decodeInboxCursor(params.cursor) : null;
	} catch (error) {
		if (error instanceof Error && error.message === "Invalid inbox cursor") {
			throw new AccountInboxApiError(400, error.message);
		}
		throw error;
	}

	const pageResult = await db().rpc("get_account_inbox_page_v2", {
		p_user_id: params.ownerUserId,
		p_now: nowIso,
		p_cursor_activity_at: cursor?.activityAt ?? null,
		p_cursor_key: cursor?.key ?? null,
		p_limit: limit + 1,
	});
	if (pageResult.error) {
		throw accountInboxDatabaseError("load account inbox", pageResult.error);
	}

	return buildAccountInboxResponseFromDatabase({
		ownerUserId: params.ownerUserId,
		value: pageResult.data,
		limit,
		now,
	});
}

export function buildAccountInboxResponseFromDatabase(params: {
	ownerUserId: string;
	value: unknown;
	limit: number;
	now: Date;
}): AccountInboxResponse {
	const pageData = accountInboxPageRpcData(params.value);
	const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, params.limit));
	const pageEntries = pageData.entries.slice(0, limit);
	const items = pageEntries.map((entry) =>
		accountInboxItemFromRow(entry, params.now),
	);
	const lastEntry = pageEntries.at(-1);

	return AccountInboxResponseSchema.parse({
		meta: createOwnedAccountResponseMeta(params.ownerUserId, params.now),
		items,
		counts: accountInboxCountsFromRow(pageData.counts),
		nextCursor:
			pageData.entries.length > limit && lastEntry
				? encodeInboxCursorParts(
						lastEntry.activity_at,
						inboxEntryKey(lastEntry),
					)
				: null,
	});
}

export async function markAccountInboxItemsSeen(params: {
	ownerUserId: string;
	items: ReadonlyArray<{ kind: "room-invite" | "friend-request"; id: string }>;
	limit?: number;
	now?: Date;
}): Promise<AccountInboxResponse> {
	if (!isUuid(params.ownerUserId)) {
		throw new AccountInboxApiError(400, "Invalid account owner");
	}

	const roomInviteIds = unique(
		params.items
			.filter((item) => item.kind === "room-invite")
			.map((item) => item.id),
	);
	const friendshipIds = unique(
		params.items
			.filter((item) => item.kind === "friend-request")
			.map((item) => item.id),
	);
	const now = params.now ?? new Date();
	const { error } = await db().rpc("mark_account_inbox_seen", {
		p_user_id: params.ownerUserId,
		p_room_invite_ids: roomInviteIds,
		p_friendship_ids: friendshipIds,
		p_seen_at: now.toISOString(),
	});
	if (error) throw accountInboxDatabaseError("mark account inbox seen", error);

	return listAccountInbox({
		ownerUserId: params.ownerUserId,
		limit: params.limit,
		now,
	});
}

function accountInboxPageRpcData(value: unknown): AccountInboxPageRpcData {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Invalid account inbox database response");
	}
	const record = value as Record<string, unknown>;
	if (
		!Array.isArray(record.entries) ||
		!record.entries.every(
			(entry) =>
				Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
		) ||
		!record.counts ||
		typeof record.counts !== "object" ||
		Array.isArray(record.counts)
	) {
		throw new Error("Invalid account inbox database response");
	}
	return {
		entries: record.entries as AccountInboxEntryRow[],
		counts: record.counts as AccountInboxCountRow,
	};
}

function accountInboxItemFromRow(
	row: AccountInboxEntryRow,
	now: Date,
): AccountInboxItem {
	const sender = {
		userId: row.sender_user_id,
		handle: row.sender_handle,
		displayName: row.sender_display_name,
		avatarUrl: row.sender_avatar_url,
	};

	if (row.item_kind === "friend-request") {
		if (row.item_state !== "pending") {
			throw new Error("Invalid friend request inbox lifecycle");
		}
		return {
			kind: "friend-request",
			friendshipId: row.item_id,
			sender,
			state: "pending",
			createdAt: row.created_at,
			activityAt: row.activity_at,
			seenAt: row.seen_at,
		};
	}
	if (row.item_kind !== "room-invite") {
		throw new Error("Invalid account inbox item kind");
	}
	if (row.item_state !== "active" && row.item_state !== "missed") {
		throw new Error("Invalid room invite inbox lifecycle");
	}

	const lifecycle = roomInviteInboxLifecycle({
		recipientStatus: row.item_state === "active" ? "pending" : "expired",
		createdAt: row.activity_at,
		missedAt: row.missed_at,
		now,
	});
	if (!lifecycle || !row.room_id || !row.target_kind) {
		throw new Error("Invalid room invite inbox lifecycle");
	}

	const common = {
		kind: "room-invite" as const,
		inviteId: row.item_id,
		roomId: row.room_id,
		sender,
		targetKind: row.target_kind,
		targetGroupId: row.target_group_id,
		targetGroupName: row.target_group_name,
		message: row.message,
		roomTitle: row.room_title,
		sourceUrl: row.source_url,
		videoFingerprint: row.video_fingerprint,
		createdAt: row.created_at,
		activityAt: lifecycle.activityAt,
		seenAt: row.seen_at,
	};

	return lifecycle.state === "active"
		? { ...common, state: "active", missedAt: null }
		: { ...common, state: "missed", missedAt: lifecycle.missedAt };
}

function countInboxItems(
	items: readonly AccountInboxItem[],
): AccountInboxCounts {
	let unseen = 0;
	let activeRoomInvites = 0;
	let pendingFriendRequests = 0;

	for (const item of items) {
		if (item.seenAt === null) unseen += 1;
		if (item.kind === "friend-request") pendingFriendRequests += 1;
		if (item.kind === "room-invite" && item.state === "active")
			activeRoomInvites += 1;
	}

	return {
		unseen,
		actionable: activeRoomInvites + pendingFriendRequests,
		activeRoomInvites,
		pendingFriendRequests,
	};
}

function compareInboxItems(
	left: AccountInboxItem,
	right: AccountInboxItem,
): number {
	const byTime = right.activityAt.localeCompare(left.activityAt);
	if (byTime !== 0) return byTime;
	return inboxItemKey(left).localeCompare(inboxItemKey(right));
}

function compareInboxItemToCursor(
	item: AccountInboxItem,
	cursor: InboxCursor,
): number {
	const byTime = cursor.activityAt.localeCompare(item.activityAt);
	if (byTime !== 0) return byTime;
	return inboxItemKey(item).localeCompare(cursor.key);
}

function inboxItemKey(item: AccountInboxItem): string {
	return item.kind === "room-invite"
		? `room-invite:${item.inviteId}`
		: `friend-request:${item.friendshipId}`;
}

function encodeInboxCursor(item: AccountInboxItem): string {
	return encodeInboxCursorParts(item.activityAt, inboxItemKey(item));
}

function encodeInboxCursorParts(activityAt: string, key: string): string {
	return Buffer.from(
		JSON.stringify({ activityAt, key } satisfies InboxCursor),
		"utf8",
	).toString("base64url");
}

function decodeInboxCursor(value: string): InboxCursor {
	if (value.length > 512) throw new Error("Invalid inbox cursor");
	try {
		const parsed = JSON.parse(
			Buffer.from(value, "base64url").toString("utf8"),
		) as unknown;
		if (!parsed || typeof parsed !== "object")
			throw new Error("invalid cursor");
		const cursor = parsed as Partial<InboxCursor>;
		if (
			typeof cursor.activityAt !== "string" ||
			!Number.isFinite(Date.parse(cursor.activityAt)) ||
			typeof cursor.key !== "string" ||
			cursor.key.length === 0
		) {
			throw new Error("invalid cursor");
		}
		return { activityAt: cursor.activityAt, key: cursor.key };
	} catch {
		throw new Error("Invalid inbox cursor");
	}
}

function inboxEntryKey(entry: AccountInboxEntryRow): string {
	return `${entry.item_kind}:${entry.item_id}`;
}

function accountInboxCountsFromRow(
	row: AccountInboxCountRow,
): AccountInboxCounts {
	return {
		unseen: databaseCount(row.unseen_count),
		actionable: databaseCount(row.actionable_count),
		activeRoomInvites: databaseCount(row.active_room_invite_count),
		pendingFriendRequests: databaseCount(row.pending_friend_request_count),
	};
}

function databaseCount(value: number | string | undefined): number {
	if (value === undefined) throw new Error("Invalid account inbox count");
	const count = Number(value);
	if (!Number.isSafeInteger(count) || count < 0) {
		throw new Error("Invalid account inbox count");
	}
	return count;
}

function unique(values: readonly string[]): string[] {
	return Array.from(new Set(values));
}

function accountInboxDatabaseError(
	operation: string,
	error: { code?: string; message: string },
): Error {
	if (error.code === "PGRST202" || error.code === "42883") {
		return new AccountInboxApiError(
			503,
			"Account inbox is temporarily unavailable",
		);
	}
	return new Error(`Failed to ${operation}: ${error.message}`);
}
