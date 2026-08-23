import assert from "node:assert/strict";
import test from "node:test";
import { handleRoomCreateRequestBody } from "./room-create";
import { RoomSourcePersistenceError } from "./room-source";

test("an empty room-create body is rejected without creating", async () => {
	const inputs: unknown[] = [];
	const result = await handleRoomCreateRequestBody({
		readBody: async () => "",
		create: async (input) => {
			inputs.push(input);
			return { roomId: "must-not-exist" };
		},
	});

	assert.deepEqual(result, {
		ok: false,
		status: 400,
		body: { error: "Invalid request", code: "INVALID_REQUEST" },
	});
	assert.deepEqual(inputs, []);
});

test("malformed and non-object room-create JSON returns stable 400 without creating", async () => {
	for (const rawBody of [
		'{"sourceUrl":',
		" ",
		"null",
		"[]",
		'"room"',
		"42",
		"true",
	]) {
		let creates = 0;
		const result = await handleRoomCreateRequestBody({
			readBody: async () => rawBody,
			create: async () => {
				creates += 1;
				return { roomId: "must-not-exist" };
			},
		});

		assert.deepEqual(result, {
			ok: false,
			status: 400,
			body: { error: "Invalid request", code: "INVALID_REQUEST" },
		});
		assert.equal(creates, 0);
	}
});

test("a room-create body read failure returns stable 400 without creating", async () => {
	let reads = 0;
	let creates = 0;
	const result = await handleRoomCreateRequestBody({
		readBody: async () => {
			reads += 1;
			throw new Error("private stream failure");
		},
		create: async () => {
			creates += 1;
			return { roomId: "must-not-exist" };
		},
	});

	assert.deepEqual(result, {
		ok: false,
		status: 400,
		body: { error: "Invalid request", code: "INVALID_REQUEST" },
	});
	assert.equal(reads, 1);
	assert.equal(creates, 0);
});

test("room create requires one bounded participant tab session", async () => {
	for (const participantSessionId of [undefined, null, 42, "", "x".repeat(129)]) {
		let creates = 0;
		const result = await handleRoomCreateRequestBody({
			readBody: async () => JSON.stringify({ participantSessionId }),
			create: async () => {
				creates += 1;
				return { roomId: "must-not-exist" };
			},
		});

		assert.deepEqual(result, {
			ok: false,
			status: 400,
			body: { error: "Invalid request", code: "INVALID_REQUEST" },
		});
		assert.equal(creates, 0);
	}
});

test("valid object JSON forwards cleaned metadata and unmodified source assertions", async () => {
	const inputs: unknown[] = [];
	const result = await handleRoomCreateRequestBody({
		readBody: async () =>
			JSON.stringify({
				participantSessionId: "participant-session-1",
				showId: "  show-1  ",
				episodeId: "episode-1",
				sourceProvider: "youtube",
				sourceUrl: "https://youtu.be/dQw4w9WgXcQ",
				videoFingerprint: "youtube|/dQw4w9WgXcQ",
				title: "  Watch together  ",
				clientRequestId: "request-1",
				extra: "ignored",
			}),
		create: async (input) => {
			inputs.push(input);
			return { roomId: "room-1" };
		},
	});

	assert.equal(result.ok, true);
	assert.deepEqual(inputs, [
		{
			participantSessionId: "participant-session-1",
			showId: "show-1",
			episodeId: "episode-1",
			sourceProvider: "youtube",
			sourceUrl: "https://youtu.be/dQw4w9WgXcQ",
			videoFingerprint: "youtube|/dQw4w9WgXcQ",
			title: "Watch together",
			clientRequestId: "request-1",
		},
	]);
});

test("room source validation failure keeps the existing stable response", async () => {
	const result = await handleRoomCreateRequestBody({
		readBody: async () =>
			JSON.stringify({
				participantSessionId: "participant-session-1",
				sourceUrl: "https://example.com/watch/one",
			}),
		create: async () => {
			throw new RoomSourcePersistenceError("invalid", "private detail");
		},
	});

	assert.deepEqual(result, {
		ok: false,
		status: 400,
		body: { error: "Invalid room source", code: "INVALID_ROOM_SOURCE" },
	});
});
