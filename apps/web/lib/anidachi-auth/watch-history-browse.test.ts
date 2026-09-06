import assert from "node:assert/strict";
import test from "node:test";

test("titles opt-in is transport-only and preserves an old caller's strict response", async () => {
	const api = await import("./watch-history-browse");
	const raw = {
		accountGeneration: 1,
		totalTitleCount: 0,
		totalSessionCount: 0,
		hasMore: false,
		nextCursor: null,
		matches: [],
		progressRows: [],
		sessionIds: [],
		sessionTimes: [],
		sessions: [],
		groups: [],
		titleSummaries: [],
		catalog: null,
		observedEpisodeCount: 0,
		completedEpisodeCount: 0,
		episodePreviews: [],
	};
	const params = {
		userId: "11111111-1111-4111-8111-111111111111",
		store: {
			async browse() {
				return raw;
			},
		},
	};
	const response = await api.browseWatchHistoryV3({
		...params,
		input: { mode: "solo", includeEpisodePreviews: true },
	});
	assert.deepEqual(response.episodePreviews, []);
	const legacy = await api.browseWatchHistoryV3({
		...params,
		input: { mode: "solo" },
	});
	assert.equal(Object.hasOwn(legacy, "episodePreviews"), false);
	assert.throws(
		() =>
			api.parseWatchHistoryBrowseQuery(
				{
					mode: "solo",
					provider: "youtube",
					titleKey: "title",
					includeEpisodePreviews: true,
				},
				"episodes",
			),
		{ code: "INVALID_QUERY" },
	);
});

test("browse rejects malformed filters before accessing storage", async () => {
	const browseApi = await import("./watch-history-browse");
	let accessed = false;
	await assert.rejects(
		browseApi.browseWatchHistoryV3({
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
	const browseApi = await import("./watch-history-browse");
	let accessed = false;
	await assert.rejects(
		browseApi.browseWatchHistoryV3({
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
	const browseApi = await import("./watch-history-browse");
	for (const [raw, want] of [
		[{}, "INVALID_DATABASE_RESPONSE"],
		[new Error("private database detail"), "HISTORY_UNAVAILABLE"],
	] as const) {
		await assert.rejects(
			browseApi.browseWatchHistoryV3({
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
