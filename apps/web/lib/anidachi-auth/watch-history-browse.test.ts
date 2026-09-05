import assert from "node:assert/strict";
import test from "node:test";

test("browse rejects malformed filters before accessing storage", async () => {
	const module = await import("./watch-history-browse");
	let accessed = false;
	await assert.rejects(
		module.browseWatchHistoryV3({
			userId: "11111111-1111-4111-8111-111111111111",
			input: { mode: "solo", groupId: "11111111-1111-4111-8111-111111111111" },
			store: {
				async browse() {
					accessed = true;
					throw new Error("database accessed");
				},
			},
		}),
		{ code: "INVALID_QUERY" },
	);
	assert.equal(accessed, false);
});

test("malformed opaque cursor fails before DB access", async () => {
	const module = await import("./watch-history-browse");
	let accessed = false;
	await assert.rejects(
		module.browseWatchHistoryV3({
			userId: "11111111-1111-4111-8111-111111111111",
			input: { mode: "shared", cursor: "deadbeef" },
			store: {
				async browse() {
					accessed = true;
					throw new Error("database");
				},
			},
		}),
		{ code: "INVALID_CURSOR" },
	);
	assert.equal(accessed, false);
});
test("browse bounds validated storage failures and does not leak database messages", async () => {
	const module = await import("./watch-history-browse");
	for (const [raw, want] of [
		[{}, "INVALID_DATABASE_RESPONSE"],
		[new Error("private database detail"), "HISTORY_UNAVAILABLE"],
	] as const) {
		await assert.rejects(
			module.browseWatchHistoryV3({
				userId: "11111111-1111-4111-8111-111111111111",
				input: { mode: "shared" },
				store: {
					async browse() {
						if (raw instanceof Error) throw raw;
						return raw;
					},
				},
			}),
			{ code: want },
		);
	}
});
