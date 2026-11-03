import assert from "node:assert/strict";
import test from "node:test";
import {
	buildFree20ContextTransfer,
	transferFree20RoomContext,
} from "./free20-abuse-transfer";

const owner = "ab000000-0000-4000-8000-000000000001";
const context = { browser: "b".repeat(64), installation: "c".repeat(64) };
const request = () => buildFree20ContextTransfer(owner, "room-test", context);
test("transfer identity is stable for exact scope and success receipt matches every fence", async () => {
	const value = request();
	assert.deepEqual(request(), value);
	assert.notEqual(
		buildFree20ContextTransfer(owner, "room-other", context).transferId,
		value.transferId,
	);
	assert.notEqual(
		buildFree20ContextTransfer(owner, "room-test", {
			...context,
			installation: "d".repeat(64),
		}).transferId,
		value.transferId,
	);
	const { browserHash: _, installationHash: __, ...binding } = value;
	let calls = 0;
	await transferFree20RoomContext(value, {
		base: "https://worker.example",
		secret: "test-internal-secret",
		fetch: async (url, options) => {
			calls++;
			assert.equal(
				String(url),
				"https://worker.example/internal/rooms/room-test/free20-context",
			);
			assert.deepEqual(JSON.parse(options!.body as string), value);
			assert.equal(options!.redirect, "error");
			assert.ok(options!.signal);
			return Response.json({ ...binding, outcome: "applied" });
		},
	});
	assert.equal(calls, 1);
});
test("missing receivers, wrong receipts, neutral busy and hung I/O all fail closed", async () => {
	const value = request();
	const { browserHash: _, installationHash: __, ...binding } = value;
	for (const response of [
		new Response(null, { status: 404 }),
		Response.json({ ...binding, outcome: "applied", roomId: "other" }),
		Response.json({
			...binding,
			outcome: "applied",
			browserHash: value.browserHash,
		}),
	])
		await assert.rejects(
			() =>
				transferFree20RoomContext(value, {
					base: "https://worker.example",
					secret: "test",
					fetch: async () => response,
				}),
			/ROOM_AUTHORITY_UNAVAILABLE/,
		);
	await assert.rejects(
		() =>
			transferFree20RoomContext(value, {
				base: "https://worker.example",
				secret: "test",
				fetch: async () =>
					Response.json({ code: "FREE20_CONTEXT_BUSY" }, { status: 409 }),
			}),
		/FREE20_CONTEXT_BUSY/,
	);
	let signal: AbortSignal | null | undefined;
	await assert.rejects(
		() =>
			transferFree20RoomContext(value, {
				base: "https://worker.example",
				secret: "test",
				timeoutMs: 5,
				fetch: async (_u, init) => {
					signal = init?.signal;
					return new Promise(() => {});
				},
			}),
		/ROOM_AUTHORITY_UNAVAILABLE/,
	);
	assert.equal(signal?.aborted, true);
});
