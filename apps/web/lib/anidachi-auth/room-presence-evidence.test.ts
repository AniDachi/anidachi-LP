import assert from "node:assert/strict";
import { test } from "node:test";
import { handleInternalRoomPresencePost } from "./room-presence-evidence";
const evidence = {
	roomId: "room",
	roomGeneration: 7,
	observedAt: 1000,
	participants: [
		{ userId: "00000000-0000-4000-8000-000000000001", sessionId: "a" },
		{ userId: "00000000-0000-4000-8000-000000000002", sessionId: "b" },
	],
};
test("internal presence rejects unauthorized before body/store access", async () => {
	const result = await handleInternalRoomPresencePost({
		authorization: null,
		secret: "test",
		readJson: async () => {
			throw new Error("must not read");
		},
		persist: async () => {
			throw new Error("must not write");
		},
	});
	assert.equal(result.status, 401);
});
test("strict callback excludes playback data; valid Free presence does not consult history", async () => {
	let calls = 0;
	const run = (input: unknown) =>
		handleInternalRoomPresencePost({
			authorization: "Bearer test",
			secret: "test",
			readJson: async () => input,
			persist: async () => {
				calls++;
				return { accepted: true };
			},
		});
	assert.equal((await run({ ...evidence, position: 5 })).status, 400);
	assert.equal(calls, 0);
	assert.deepEqual(await run(evidence), {
		status: 200,
		body: { accepted: true },
	});
	assert.equal(calls, 1);
});
test("failed persistence is retryable and malformed ack never succeeds", async () => {
	const result = await handleInternalRoomPresencePost({
		authorization: "Bearer test",
		secret: "test",
		readJson: async () => evidence,
		persist: async () => ({ ok: true }),
	});
	assert.equal(result.status, 503);
});
