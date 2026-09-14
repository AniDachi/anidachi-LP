import assert from "node:assert/strict";
import { test } from "node:test";
import { listAccountInbox, markAccountInboxItemsSeen } from "./account-inbox";
import { listRoomInvites } from "./social";

const OWNER = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-09-14T12:00:00.000Z");

test("Inbox uses the opt-in RPC for list and seen, with the same authenticated owner", async (t) => {
	const previousFetch = globalThis.fetch;
	const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	process.env.NEXT_PUBLIC_SUPABASE_URL =
		"https://invite-return-db.example.test";
	process.env.SUPABASE_SERVICE_ROLE_KEY = "local-fixture-not-a-secret";
	t.after(() => {
		globalThis.fetch = previousFetch;
		if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
		else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
		if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
		else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
	});
	const calls: { url: URL; body: Record<string, unknown> }[] = [];
	globalThis.fetch = async (input, init) => {
		const url = new URL(String(input));
		assert.equal(url.hostname, "invite-return-db.example.test");
		calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
		if (url.pathname.endsWith("/room_invites")) return Response.json([]);
		if (url.pathname.endsWith("/mark_account_inbox_seen"))
			return Response.json(1);
		return Response.json({
			entries: [],
			counts: {
				unseen_count: 0,
				actionable_count: 0,
				active_room_invite_count: 0,
				pending_friend_request_count: 0,
			},
		});
	};
	await listAccountInbox({ ownerUserId: OWNER, now: NOW });
	await listAccountInbox({
		ownerUserId: OWNER,
		now: NOW,
		includeReturnable: true,
	});
	await markAccountInboxItemsSeen({
		ownerUserId: OWNER,
		items: [{ kind: "room-invite", id: OWNER }],
		now: NOW,
		includeReturnable: true,
	});
	assert.deepEqual(
		calls.map((call) => call.url.pathname),
		[
			"/rest/v1/rpc/get_account_inbox_page_v2",
			"/rest/v1/rpc/get_account_inbox_page_v3",
			"/rest/v1/rpc/mark_account_inbox_seen",
			"/rest/v1/rpc/get_account_inbox_page_v3",
		],
	);
	assert.ok(calls.every((call) => call.body.p_user_id === OWNER));
	await listRoomInvites(OWNER, "return-room");
	const query = calls.at(-1)!.url.searchParams;
	assert.equal(query.get("room_id"), "eq.return-room");
	assert.equal(query.get("sender_user_id"), `eq.${OWNER}`);
	assert.equal(query.get("recipients.superseded_at"), "is.null");
});
