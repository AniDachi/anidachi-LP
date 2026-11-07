import assert from "node:assert/strict";
import test from "node:test";
import { boundedFree20, readBoundedFree20Json } from "./free20-abuse-http";

test("deadline cancels stalled body and releases its lock even if source cancellation never settles", async () => {
	let cancelled = false;
	const stream = new ReadableStream<Uint8Array>({
		cancel() {
			cancelled = true;
			return new Promise(() => {});
		},
	});
	await assert.rejects(
		boundedFree20(5, (signal) => readBoundedFree20Json(stream, 4096, signal)),
		/ROOM_AUTHORITY_UNAVAILABLE/,
	);
	assert.equal(cancelled, true);
	assert.equal(stream.locked, false);
});
test("already-aborted reads cancel without pulling data and release their lock", async () => {
	const controller = new AbortController();
	controller.abort();
	let cancelled = false,
		pulls = 0;
	const stream = new ReadableStream<Uint8Array>(
		{
			pull() {
				pulls++;
			},
			cancel() {
				cancelled = true;
			},
		},
		{ highWaterMark: 0 },
	);
	await assert.rejects(
		boundedFree20(5, () =>
			readBoundedFree20Json(stream, 4096, controller.signal),
		),
	);
	assert.equal(cancelled, true);
	assert.equal(pulls, 0);
	assert.equal(stream.locked, false);
});
test("complete, malformed and oversized bodies all release their reader", async () => {
	for (const [text, limit, success] of [
		['{"ok":true}', 4096, true],
		["{", 4096, false],
		['{"oversized":true}', 2, false],
	] as const) {
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode(text));
				controller.close();
			},
		});
		const controller = new AbortController();
		if (success)
			assert.deepEqual(
				await readBoundedFree20Json(stream, limit, controller.signal),
				{ ok: true },
			);
		else
			await assert.rejects(
				readBoundedFree20Json(stream, limit, controller.signal),
			);
		assert.equal(stream.locked, false);
		controller.abort();
		assert.equal(stream.locked, false);
	}
});
