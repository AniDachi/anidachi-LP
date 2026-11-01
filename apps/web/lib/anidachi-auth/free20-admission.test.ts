import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import test from "node:test";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { createRequestStoreForAPI } from "next/dist/server/async-storage/request-store";
import { createWorkStore } from "next/dist/server/async-storage/work-store";
import { NextRequest } from "next/server";
import { POST as connect } from "../../app/api/rooms/[roomId]/connect/route";
import { POST as create } from "../../app/api/rooms/route";
import { ACCESS_TOKEN_COOKIE } from "./cookies";
import { signAccessToken } from "./jwt";

const owner = "f6200000-0000-4000-8000-000000000001";
async function request(
	kind: "create" | "connect",
	version: string | null = "1",
	caller = owner,
) {
	const path =
		kind === "create" ? "/api/rooms" : "/api/rooms/daily-room/connect";
	const cookie = await signAccessToken({
		sub: caller,
		email: "free20@example.test",
		plan: "free",
	});
	const req = new NextRequest(`https://web.example.test${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-anidachi-media-protocol": "3",
			...(version === null ? {} : { "x-anidachi-free20-client": version }),
			cookie: `${ACCESS_TOKEN_COOKIE}=${cookie}`,
		},
		body: JSON.stringify({
			participantSessionId: "tab-a",
			...(kind === "create" ? { clientRequestId: "request-a" } : {}),
		}),
	});
	const store = createRequestStoreForAPI(
		req,
		req.nextUrl,
		{ tags: [], expirationsByCacheKind: new Map() },
		undefined,
		undefined,
	);
	const work = createWorkStore({
		page: path,
		buildId: "test",
		previouslyRevalidatedTags: [],
		renderOpts: {
			supportsDynamicResponse: true,
			waitUntil: undefined,
			onClose: () => undefined,
			onAfterTaskError: undefined,
			experimental: {
				isRoutePPREnabled: false,
				cacheComponents: false,
				authInterrupts: false,
			},
		},
	});
	return workAsyncStorage.run(work, () =>
		workUnitAsyncStorage.run(store, () =>
			kind === "create"
				? create(req)
				: connect(req, { params: Promise.resolve({ roomId: "daily-room" }) }),
		),
	);
}
type Options = {
	flag?: string;
	enabled?: boolean;
	marked?: boolean;
	used?: number;
	paid?: boolean;
	invalid?: boolean;
	sqlZero?: boolean;
	sqlUpdate?: boolean;
	member?: boolean;
	roomPlan?: "free" | "plus";
	sqlErrorCode?: string;
	sqlAuthorityUnavailable?: boolean;
	conflict?: boolean;
};
async function fixture(
	options: Options,
	run: (state: {
		creates: number;
		claims: number;
		updates: number;
		versions: unknown[];
		legacyQuotaReads: number;
		accessReads: number;
	}) => Promise<void>,
) {
	const originalFetch = globalThis.fetch;
	const env = {
		ANIDACHI_JWT_SECRET: "free20-admission-local-fixture",
		NEXT_PUBLIC_SUPABASE_URL: "https://free20-db.example.test",
		SUPABASE_SERVICE_ROLE_KEY: "local-fixture-role",
		ANIDACHI_FREE20_ACCOUNTING_ENABLED: options.flag ?? "true",
	};
	const original = Object.fromEntries(
		Object.keys(env).map((key) => [key, process.env[key]]),
	);
	Object.assign(process.env, env);
	const state = {
		creates: 0,
		claims: 0,
		updates: 0,
		versions: [] as unknown[],
		legacyQuotaReads: 0,
		accessReads: 0,
	};
	const now = new Date();
	const until = new Date(now.getTime() + 300_000).toISOString();
	const resetAt = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
	).toISOString();
	const plan = options.paid ? "plus" : "free";
	const row = {
		room_id: "daily-room",
		host_user_id: owner,
		host_plan_code: options.roomPlan ?? "free",
		status: "lobby",
		host_connected_at: now.toISOString(),
		hosting_time_mode: options.marked === false ? null : "daily_free20",
		max_participants: 4,
		max_media_seats: 4,
		can_name_room: false,
		can_send_push_invites: false,
		media_lease: {
			roomId: "daily-room",
			roomGeneration: 1,
			issuedAt: now.toISOString(),
			paidUntil: null,
			capabilities: {
				mediaProtocolVersion: 3,
				hostPlanCode: "free",
				maxParticipants: 4,
				maxCameras: 4,
				maxMediaSeats: 4,
				capabilityRevision: 1,
				capabilitiesValidUntil: until,
			},
		},
	};
	globalThis.fetch = async (input, init) => {
		const req = new Request(input, init);
		const url = new URL(req.url);
		assert.equal(url.origin, "https://free20-db.example.test");
		if (url.pathname === "/rest/v1/users")
			return Response.json({
				id: owner,
				display_name: "Host",
				avatar_url: null,
			});
		if (url.pathname === "/rest/v1/rooms") {
			if (req.method === "PATCH") state.updates++;
			return Response.json(
				req.method === "PATCH" ? [{ room_id: "daily-room" }] : row,
			);
		}
		if (url.pathname === "/rest/v1/personal_history_policy")
			return Response.json({ active: true });
		if (url.pathname === "/rest/v1/room_members")
			return Response.json(
				options.member
					? { user_id: "f6200000-0000-4000-8000-000000000002" }
					: null,
			);
		if (url.pathname.endsWith("/resolve_watch_history_access_v1")) {
			const caller = (await req.json()).p_user_id;
			return Response.json({
				planCode: plan,
				paidUntil: options.paid ? until : null,
				selectedPlanExpiresAt: options.paid ? until : null,
				history: {
					accessVersion: 1,
					ownerUserId: caller,
					accountGeneration: 1,
					accessEpoch: 1,
					youtubeConsentEpoch: 1,
					state: options.paid ? "allowed" : "plan_required",
					serverTime: now.toISOString(),
					captureNotBefore: "2026-09-01T00:00:00Z",
					validUntil: until,
					youtubeHistoryEnabled: false,
				},
				hosting: {
					hostingPolicyVersion: 1,
					hostingActivationAt: "2026-09-01T00:00:00Z",
					canHost: !!options.paid,
					trialEligibility: "unavailable",
					trialEndsAt: null,
				},
			});
		}
		if (url.pathname.endsWith("/resolve_free20_hosting_access_v1")) {
			state.accessReads++;
			assert.deepEqual(await req.json(), { p_user_id: owner });
			if (options.enabled === false) return Response.json({ enabled: false });
			const used = options.used ?? 420;
			return Response.json({
				enabled: true,
				ownerUserId: options.invalid
					? "f6200000-0000-4000-8000-000000000002"
					: owner,
				planCode: plan,
				serverTime: now.toISOString(),
				resetAt,
				usedSeconds: used,
				remainingSeconds: options.paid ? null : Math.max(0, 1200 - used),
				canHost: !!options.paid || used < 1200,
			});
		}
		if (url.pathname === "/rest/v1/usage_daily") {
			state.legacyQuotaReads++;
			return Response.json({ host_seconds: options.used ?? 420 });
		}
		if (
			url.pathname.endsWith("/create_room_with_active_session_v4") ||
			url.pathname.endsWith("/claim_active_room_session_v4")
		) {
			const creating = url.pathname.endsWith(
				"/create_room_with_active_session_v4",
			);
			if (creating) state.creates++;
			else state.claims++;
			state.versions.push((await req.json()).p_free20_client_version);
			if (options.sqlErrorCode)
				return Response.json(
					{ code: options.sqlErrorCode, message: "lock or statement timeout" },
					{ status: 400 },
				);
			if (options.sqlUpdate)
				return Response.json(
					{ code: "P0001", message: "ROOM_UPDATE_REQUIRED_FREE20" },
					{ status: 400 },
				);
			if (options.sqlZero)
				return Response.json(
					{ code: "P0001", message: "QUOTA_EXHAUSTED" },
					{ status: 400 },
				);
			if (options.sqlAuthorityUnavailable)
				return Response.json(
					{ code: "P0001", message: "ROOM_AUTHORITY_UNAVAILABLE" },
					{ status: 400 },
				);
			if (options.conflict)
				return Response.json([
					{
						outcome: "conflict",
						...(creating ? { room_record: null } : {}),
						active_room: {
							roomId: "old-room",
							role: "host",
							provider: null,
							title: null,
						},
					},
				]);
			return Response.json([
				{
					outcome: "claimed",
					...(creating ? { room_record: row } : {}),
					active_room: null,
				},
			]);
		}
		throw new Error(`Unexpected request: ${req.method} ${url.pathname}`);
	};
	try {
		await run(state);
	} finally {
		globalThis.fetch = originalFetch;
		for (const [key, value] of Object.entries(original)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
}
for (const kind of ["create", "connect"] as const) {
	test(`gated ${kind} issues the confirmed 13-minute remainder without legacy quota`, async () =>
		fixture({}, async (state) => {
			const response = await request(kind);
			const body = await response.json();
			assert.equal(response.status, 200, JSON.stringify(body));
			assert.equal(body.quota.remainingSeconds, 780);
			assert.equal(state.legacyQuotaReads, 0);
			assert.equal(body.mediaCapabilities.maxParticipants, 4);
		}));
	test(`${kind} refuses zero and invalid authority before claiming`, async () => {
		for (const [options, status] of [
			[{ used: 1200 }, 403],
			[{ invalid: true }, 503],
		] as const)
			await fixture(options, async (state) => {
				const response = await request(kind);
				assert.equal(response.status, status);
				assert.equal(state.creates + state.claims, 0);
				assert.equal("roomToken" in (await response.json()), false);
			});
	});
	test(`${kind} handles quota exhausted inside the locked SQL call`, async () =>
		fixture({ sqlZero: true }, async () => {
			const response = await request(kind);
			assert.equal(response.status, 403);
			assert.equal((await response.json()).code, "QUOTA_EXHAUSTED");
		}));
	test(`${kind} returns 503 when authority becomes unavailable inside the locked SQL call`, async () =>
		fixture({ sqlAuthorityUnavailable: true }, async (state) => {
			const response = await request(kind);
			const body = await response.json();
			assert.equal(response.status, 503);
			assert.equal(body.code, "ROOM_AUTHORITY_UNAVAILABLE");
			assert.equal("roomToken" in body, false);
			assert.equal(state.creates + state.claims, 1);
		}));
	test(`${kind} retains active-room conflict without another allowance`, async () =>
		fixture({ conflict: true }, async () => {
			const response = await request(kind);
			assert.equal(response.status, 409);
			assert.equal((await response.json()).activeRoom.roomId, "old-room");
		}));
}
test("disabled create never consults new SQL authority or issues Free access", async () =>
	fixture({ flag: "false" }, async (state) => {
		const response = await request("create");
		assert.equal(response.status, 403);
		assert.equal(state.accessReads, 0);
		assert.equal(state.creates, 0);
	}));
test("server opt-in alone cannot bypass a disabled database policy", async () =>
	fixture({ enabled: false }, async (state) => {
		const response = await request("create");
		assert.equal(response.status, 403);
		assert.equal(state.creates, 0);
	}));
test("legacy room is not adopted by Free20 even after a paid upgrade", async () =>
	fixture({ marked: false, paid: true }, async (state) => {
		const response = await request("connect");
		assert.equal(response.status, 403);
		assert.equal(state.claims, 0);
	}));
test("marked room with server flag removed fails closed", async () =>
	fixture({ flag: "false" }, async (state) => {
		const response = await request("connect");
		assert.equal(response.status, 503);
		assert.equal(state.claims, 0);
	}));
test("paid right reconnects the same Free-capacity room after its daily quota is used", async () =>
	fixture({ paid: true, used: 1500 }, async (state) => {
		const response = await request("connect");
		const body = await response.json();
		assert.equal(response.status, 200, JSON.stringify(body));
		assert.equal(body.quota, null);
		assert.equal(body.mediaCapabilities.hostPlanCode, "free");
		assert.equal(body.mediaCapabilities.maxParticipants, 4);
		assert.equal(state.legacyQuotaReads, 0);
	}));

for (const kind of ["create", "connect"] as const) {
	test(`${kind} passes the independent capability to SQL`, async () =>
		fixture({}, async (state) => {
			assert.equal((await request(kind)).status, 200);
			assert.deepEqual(state.versions, [1]);
		}));
	test(`${kind} returns friendly426 without token or room touch for unsupported marked host`, async () => {
		for (const version of [null, "0", "2", "01", "1, 1"])
			await fixture({ sqlUpdate: true }, async (state) => {
				const response = await request(kind, version);
				const body = await response.json();
				assert.equal(response.status, 426);
				assert.equal(body.code, "ROOM_UPDATE_REQUIRED");
				assert.equal(
					body.message,
					"Update AniDachi to use your daily free hosting time. You can still join friends' rooms.",
				);
				assert.equal("roomToken" in body, false);
				assert.equal(state.updates, 0);
				if (kind === "create") assert.deepEqual(state.versions, [null]);
				else assert.equal(state.claims, 0);
			});
	});
	test(`${kind} unsupported marked host426 precedes exhausted budget`, async () =>
		fixture({ used: 1200, sqlUpdate: true }, async (state) => {
			const response = await request(kind, null);
			assert.equal(response.status, 426);
			assert.equal(state.updates, 0);
		}));
	test(`${kind} paid-upgraded marked room still rejects old host`, async () =>
		fixture({ paid: true, sqlUpdate: true }, async (state) => {
			const response = await request(kind, null);
			assert.equal(response.status, 426);
			assert.equal(state.updates, 0);
		}));
}

test("old guest can connect to marked room without the host capability", async () =>
	fixture({ member: true }, async (state) => {
		const response = await request(
			"connect",
			null,
			"f6200000-0000-4000-8000-000000000002",
		);
		assert.equal(response.status, 200, JSON.stringify(await response.json()));
		assert.deepEqual(state.versions, [null]);
		assert.equal(state.claims, 1);
	}));
test("capability cannot turn an outsider into a room member", async () =>
	fixture({}, async (state) => {
		const response = await request(
			"connect",
			"1",
			"f6200000-0000-4000-8000-000000000002",
		);
		assert.equal(response.status, 403);
		assert.equal(state.claims + state.updates, 0);
	}));
for (const kind of ["create", "connect"] as const) {
	test(`${kind} retains ordinary old paid client behavior`, async () =>
		fixture({ paid: true, marked: false, roomPlan: "plus" }, async (state) => {
			const response = await request(kind, null);
			assert.equal(response.status, 200, JSON.stringify(await response.json()));
			assert.deepEqual(state.versions, [null]);
		}));
	for (const code of ["55P03", "57014"])
		test(`${kind} SQL ${code} stays unavailable503`, async () =>
			fixture({ sqlErrorCode: code }, async (state) => {
				const response = await request(kind);
				assert.equal(response.status, 503);
				assert.equal(state.updates, 0);
			}));
}
