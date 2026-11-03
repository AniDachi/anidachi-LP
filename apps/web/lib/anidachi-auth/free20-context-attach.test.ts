import assert from "node:assert/strict";
import test from "node:test";
import { handleFree20ContextAttach } from "./free20-context-attach";

const input = {
	version: 1,
	transferId: "a".repeat(64),
	ownerUserId: "11111111-1111-4111-8111-111111111111",
	roomId: "transfer-room",
	roomGeneration: 1,
	browserHash: "b".repeat(64),
	installationHash: "c".repeat(64),
};
const request = (value: unknown = input, auth = "Bearer internal") =>
	new Request(
		"https://web.test/api/internal/rooms/transfer-room/free20-context",
		{
			method: "POST",
			headers: { Authorization: auth },
			body: JSON.stringify(value),
		},
	);
test("internal attach binds owner and room, invokes only attachment and hides markers", async () => {
	const calls: unknown[] = [];
	const deps = {
		authorize: (x: string | null) => x === "Bearer internal",
		attach: async (value: typeof input) => {
			calls.push(value);
		},
	};
	const response = await handleFree20ContextAttach(
		request(),
		"transfer-room",
		deps,
	);
	assert.equal(response.status, 200);
	assert.deepEqual(calls, [input]);
	assert.deepEqual(await response.json(), {
		version: 1,
		transferId: input.transferId,
		ownerUserId: input.ownerUserId,
		roomId: input.roomId,
		roomGeneration: 1,
		outcome: "applied",
	});
	assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});
test("internal attach refuses unauthenticated, extra fields, wrong path and unknown SQL result", async () => {
	let calls = 0;
	const deps = {
		authorize: (x: string | null) => x === "Bearer internal",
		attach: async () => {
			calls++;
			throw new Error("unknown SQL ACK");
		},
	};
	assert.equal(
		(
			await handleFree20ContextAttach(
				request(input, "Bearer wrong"),
				"transfer-room",
				deps,
			)
		).status,
		401,
	);
	assert.equal(
		(
			await handleFree20ContextAttach(
				request({ ...input, allowance: 1200 }),
				"transfer-room",
				deps,
			)
		).status,
		400,
	);
	assert.equal(
		(await handleFree20ContextAttach(request(), "wrong", deps)).status,
		400,
	);
	assert.equal(calls, 0);
	assert.equal(
		(await handleFree20ContextAttach(request(), "transfer-room", deps)).status,
		503,
	);
	assert.equal(calls, 1);
	const busy = await handleFree20ContextAttach(request(), "transfer-room", {
		...deps,
		attach: async () => {
			throw new Error("FREE20_CONTEXT_BUSY");
		},
	});
	assert.equal(busy.status, 409);
	assert.deepEqual(await busy.json(), { code: "FREE20_CONTEXT_BUSY" });
});

test("actual internal route accepts SQL timestamp receipt and forwards only the bound attachment RPC", async () => {
	const { NextRequest } = await import("next/server");
	const { POST } = await import(
		"../../app/api/internal/rooms/[roomId]/free20-context/route"
	);
	const originalFetch = globalThis.fetch;
	const values = {
		NEXT_PUBLIC_SUPABASE_URL: "https://attach-db.test",
		SUPABASE_SERVICE_ROLE_KEY: "local-test",
		ANIDACHI_INTERNAL_API_SECRET: "internal",
	};
	const previous = Object.fromEntries(
		Object.keys(values).map((k) => [k, process.env[k]]),
	);
	Object.assign(process.env, values);
	let calls = 0;
	globalThis.fetch = async (url, init) => {
		const req = new Request(url, init);
		calls++;
		assert.equal(
			req.url,
			"https://attach-db.test/rest/v1/rpc/attach_free20_room_context_v1",
		);
		assert.deepEqual(await req.json(), {
			p_user_id: input.ownerUserId,
			p_room_id: input.roomId,
			p_browser_hash: input.browserHash,
			p_installation_hash: input.installationHash,
		});
		return Response.json({
			roomId: input.roomId,
			committedSeconds: 1140,
			serverTime: "2026-11-03T12:00:00+00:00",
		});
	};
	try {
		const response = await POST(new NextRequest(request()), {
			params: Promise.resolve({ roomId: input.roomId }),
		});
		assert.equal(response.status, 200);
		assert.equal(calls, 1);
	} finally {
		globalThis.fetch = originalFetch;
		for (const [k, v] of Object.entries(previous)) {
			if (v === undefined) delete process.env[k];
			else process.env[k] = v;
		}
	}
});
