import assert from "node:assert/strict";
import test from "node:test";
import type { RoomSourcePersistenceCallback } from "@anidachi/protocol";
import {
	buildRoomSourceLaunchUrl,
	deriveDurableRoomSource,
	handleInternalRoomSourcePost,
	parseRoomSourcePersistenceRpcResult,
	RoomSourcePersistenceError,
	roomSourceCreationColumns,
	roomSourcePersistenceRpcArguments,
} from "./room-source";

const youtubeSource = {
	provider: "youtube",
	sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
	canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
	videoFingerprint: "youtube|dQw4w9WgXcQ",
} as const;

const callback: RoomSourcePersistenceCallback = {
	roomId: "room-1",
	sourceGeneration: 2,
	source: youtubeSource,
};

test("creation canonicalizes a supported URL into one complete generation-one tuple", () => {
	assert.deepEqual(
		roomSourceCreationColumns({
			sourceUrl:
				"https://m.youtube.com/watch/?utm_source=chat&v=dQw4w9WgXcQ#old=hash",
			sourceProvider: "youtube",
			videoFingerprint: "youtube|dQw4w9WgXcQ",
		}),
		{
			source_provider: "youtube",
			source_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			video_fingerprint: "youtube|dQw4w9WgXcQ",
			source_generation: 1,
		},
	);
});

test("creation derives the complete descriptor for existing URL-only Watch History callers", () => {
	assert.deepEqual(
		roomSourceCreationColumns({
			sourceUrl:
				"https://www.crunchyroll.com/watch/GOLD22222/renamed-episode?ref=history",
		}),
		{
			source_provider: "crunchyroll",
			source_url: "https://www.crunchyroll.com/watch/GOLD22222",
			video_fingerprint: "crunchyroll|watch/GOLD22222",
			source_generation: 1,
		},
	);
});

test("creation preserves an explicitly empty source as a null tuple", () => {
	assert.deepEqual(roomSourceCreationColumns({}), {
		source_provider: null,
		source_url: null,
		video_fingerprint: null,
		source_generation: null,
	});
});

test("creation rejects partial, unsupported, over-bound, and mismatched source input", () => {
	const invalidInputs = [
		{ videoFingerprint: "youtube|dQw4w9WgXcQ" },
		{ sourceProvider: "youtube" },
		{ sourceUrl: "https://example.com/watch/one" },
		{
			sourceUrl: `https://www.youtube.com/watch?v=dQw4w9WgXcQ&x=${"a".repeat(2_048)}`,
		},
		{
			sourceUrl: youtubeSource.sourceUrl,
			sourceProvider: "crunchyroll",
		},
		{
			sourceUrl: youtubeSource.sourceUrl,
			videoFingerprint: "youtube|different",
		},
		{ sourceUrl: null },
	];

	for (const input of invalidInputs) {
		assert.throws(
			() => roomSourceCreationColumns(input),
			(error: unknown) =>
				error instanceof RoomSourcePersistenceError && error.kind === "invalid",
		);
	}
});

test("durable rows expose only an internally exact populated descriptor", () => {
	assert.deepEqual(
		deriveDurableRoomSource({
			source_provider: "youtube",
			source_url: youtubeSource.sourceUrl,
			video_fingerprint: youtubeSource.videoFingerprint,
			source_generation: 4,
		}),
		{ source: youtubeSource, sourceGeneration: 4, legacy: false },
	);
});

test("legacy supported rows canonicalize read-only without inventing a generation", () => {
	assert.deepEqual(
		deriveDurableRoomSource({
			source_provider: null,
			source_url: "https://youtu.be/dQw4w9WgXcQ?si=legacy",
			video_fingerprint: null,
			source_generation: null,
		}),
		{ source: youtubeSource, sourceGeneration: null, legacy: true },
	);
});

test("empty, partial, unsupported, mismatched, and malicious durable rows fail closed", () => {
	assert.equal(
		deriveDurableRoomSource({
			source_provider: null,
			source_url: null,
			video_fingerprint: null,
			source_generation: null,
		}),
		null,
	);

	const invalidRows = [
		{
			source_provider: "youtube",
			source_url: youtubeSource.sourceUrl,
			video_fingerprint: youtubeSource.videoFingerprint,
			source_generation: null,
		},
		{
			source_provider: null,
			source_url: null,
			video_fingerprint: youtubeSource.videoFingerprint,
			source_generation: null,
		},
		{
			source_provider: null,
			source_url: "https://example.com/watch/one",
			video_fingerprint: null,
			source_generation: null,
		},
		{
			source_provider: null,
			source_url: "javascript:alert(1)",
			video_fingerprint: null,
			source_generation: null,
		},
		{
			source_provider: null,
			source_url: youtubeSource.sourceUrl,
			video_fingerprint: "youtube|different",
			source_generation: null,
		},
		{
			source_provider: "crunchyroll",
			source_url: youtubeSource.sourceUrl,
			video_fingerprint: youtubeSource.videoFingerprint,
			source_generation: 2,
		},
	];

	for (const row of invalidRows) {
		assert.equal(deriveDurableRoomSource(row), null);
	}
});

test("launch handoff adds the room hash only after exact canonical validation", () => {
	assert.equal(
		buildRoomSourceLaunchUrl(youtubeSource, "room-1"),
		"https://www.youtube.com/watch?v=dQw4w9WgXcQ#anidachiRoom=room-1",
	);
	assert.equal(
		buildRoomSourceLaunchUrl(
			{ ...youtubeSource, sourceUrl: "https://evil.example/watch/one" },
			"room-1",
		),
		null,
	);
	assert.equal(buildRoomSourceLaunchUrl(youtubeSource, ""), null);
});

test("the RPC wrapper arguments are exactly the five deployed Task 5A arguments", () => {
	assert.deepEqual(roomSourcePersistenceRpcArguments(callback), {
		p_room_id: "room-1",
		p_source_provider: "youtube",
		p_source_url: youtubeSource.sourceUrl,
		p_video_fingerprint: youtubeSource.videoFingerprint,
		p_source_generation: 2,
	});
});

test("RPC results become exact shared persisted and stale acknowledgements", () => {
	assert.deepEqual(
		parseRoomSourcePersistenceRpcResult(
			[{ outcome: "persisted", source_generation: 2 }],
			2,
		),
		{ ok: true, outcome: "persisted", sourceGeneration: 2 },
	);
	assert.deepEqual(
		parseRoomSourcePersistenceRpcResult(
			[{ outcome: "stale", source_generation: 2 }],
			2,
		),
		{ ok: true, outcome: "stale", sourceGeneration: 2 },
	);
});

test("RPC result parsing rejects extra rows, extra fields, and wrong generations", () => {
	const malformed = [
		[],
		[
			{ outcome: "persisted", source_generation: 2 },
			{ outcome: "persisted", source_generation: 2 },
		],
		[{ outcome: "persisted", source_generation: 2, secret: "leak" }],
		[{ outcome: "persisted", source_generation: 3 }],
	];
	for (const value of malformed) {
		assert.throws(
			() => parseRoomSourcePersistenceRpcResult(value, 2),
			(error: unknown) =>
				error instanceof RoomSourcePersistenceError &&
				error.kind === "unexpected",
		);
	}
});

test("internal callback authenticates before parsing the request body", async () => {
	let bodyReads = 0;
	let persists = 0;
	const response = await handleInternalRoomSourcePost({
		authorization: "Bearer wrong",
		secret: "correct",
		roomId: "room-1",
		readJson: async () => {
			bodyReads += 1;
			return callback;
		},
		persist: async () => {
			persists += 1;
			return { ok: true, outcome: "persisted", sourceGeneration: 2 };
		},
	});

	assert.deepEqual(response, {
		status: 401,
		body: { error: "Unauthorized", code: "UNAUTHORIZED" },
	});
	assert.equal(bodyReads, 0);
	assert.equal(persists, 0);
});

test("internal callback rejects malformed, extra, and path-mismatched bodies", async () => {
	for (const body of [
		null,
		{ ...callback, extra: true },
		{ ...callback, roomId: "room-2" },
	]) {
		let persists = 0;
		const response = await handleInternalRoomSourcePost({
			authorization: "Bearer correct",
			secret: "correct",
			roomId: "room-1",
			readJson: async () => body,
			persist: async () => {
				persists += 1;
				return { ok: true, outcome: "persisted", sourceGeneration: 2 };
			},
		});
		assert.deepEqual(response, {
			status: 400,
			body: { error: "Invalid room source callback", code: "INVALID_REQUEST" },
		});
		assert.equal(persists, 0);
	}
});

test("internal callback returns the exact persisted or stale acknowledgement", async () => {
	for (const outcome of ["persisted", "stale"] as const) {
		const acknowledgement = { ok: true, outcome, sourceGeneration: 2 } as const;
		const response = await handleInternalRoomSourcePost({
			authorization: "Bearer correct",
			secret: "correct",
			roomId: "room-1",
			readJson: async () => callback,
			persist: async (received) => {
				assert.deepEqual(received, callback);
				return acknowledgement;
			},
		});
		assert.deepEqual(response, { status: 200, body: acknowledgement });
	}
});

test("internal callback maps every database failure to a stable privacy-safe response", async () => {
	const scenarios = [
		["invalid", 400, "INVALID_ROOM_SOURCE", "Invalid room source"],
		["not-found", 404, "ROOM_NOT_FOUND", "Room not found"],
		["ended", 409, "ROOM_ENDED", "Room has ended"],
		["conflict", 409, "ROOM_SOURCE_CONFLICT", "Room source conflict"],
		[
			"unexpected",
			500,
			"ROOM_SOURCE_PERSISTENCE_FAILED",
			"Unable to persist room source",
		],
	] as const;

	for (const [kind, status, code, error] of scenarios) {
		const response = await handleInternalRoomSourcePost({
			authorization: "Bearer correct",
			secret: "correct",
			roomId: "room-1",
			readJson: async () => callback,
			persist: async () => {
				throw new RoomSourcePersistenceError(kind, "database secret detail");
			},
		});
		assert.deepEqual(response, { status, body: { error, code } });
		assert.equal(
			JSON.stringify(response).includes("database secret detail"),
			false,
		);
	}
});
