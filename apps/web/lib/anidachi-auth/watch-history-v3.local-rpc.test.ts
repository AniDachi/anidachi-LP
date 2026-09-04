import assert from "node:assert/strict";
import test from "node:test";
import {
	buildWatchHistoryV3Response,
	parseBoundedWatchHistoryPage,
} from "./watch-history-v3";

const localRpcJson = process.env.WATCH_HISTORY_LOCAL_RPC_JSON;
const enabled = Boolean(localRpcJson);
const required = process.env.WATCH_HISTORY_REQUIRE_LOCAL_RPC === "1";
const USER_ID = "66666666-6666-4666-8666-666666666666";

type RecordValue = Record<string, unknown>;

function exactRecord(value: unknown, keys: string[]): RecordValue {
	assert.ok(
		value !== null && typeof value === "object" && !Array.isArray(value),
	);
	const record = value as RecordValue;
	assert.deepEqual(Object.keys(record).sort(), [...keys].sort());
	return record;
}

function parseResourceEpisodeCursor(
	cursor: string,
	expected: {
		userId: string;
		accountGeneration: number;
		provider: string;
		titleKey: string;
	},
) {
	assert.match(cursor, /^(?:[0-9a-f]{2})+$/);
	const value: unknown = JSON.parse(
		Buffer.from(cursor, "hex").toString("utf8"),
	);
	const record = exactRecord(value, [
		"v",
		"userId",
		"accountGeneration",
		"provider",
		"titleKey",
		"observedAt",
		"episodeKey",
	]);
	assert.equal(record.v, 1);
	assert.equal(record.userId, expected.userId);
	assert.equal(record.accountGeneration, expected.accountGeneration);
	assert.equal(record.provider, expected.provider);
	assert.equal(record.titleKey, expected.titleKey);
	assert.equal(typeof record.observedAt, "string");
	assert.equal(typeof record.episodeKey, "string");
}

function parseResourceTitlePage(value: unknown) {
	const page = exactRecord(value, [
		"accountGeneration",
		"totalTitleCount",
		"hasMore",
		"titleSummaries",
		"progressRows",
		"sessionIds",
	]);
	assert.ok(Array.isArray(page.titleSummaries));
	assert.ok(Array.isArray(page.progressRows));
	assert.ok(Array.isArray(page.sessionIds));
	assert.equal(typeof page.accountGeneration, "number");
	for (const rawSummary of page.titleSummaries) {
		const summary = exactRecord(rawSummary, [
			"provider",
			"titleKey",
			"lastWatchedAt",
			"observedEpisodeCount",
			"completedEpisodeCount",
			"episodePage",
			"catalog",
		]);
		const episodePage = exactRecord(summary.episodePage, [
			"complete",
			"nextCursor",
		]);
		assert.equal(typeof episodePage.complete, "boolean");
		assert.ok(
			episodePage.nextCursor === null ||
				typeof episodePage.nextCursor === "string",
		);
		if (typeof episodePage.nextCursor === "string") {
			parseResourceEpisodeCursor(episodePage.nextCursor, {
				userId: USER_ID,
				accountGeneration: page.accountGeneration as number,
				provider: summary.provider as string,
				titleKey: summary.titleKey as string,
			});
		}
	}
	return page;
}

function parseResourceDetailPage(value: unknown) {
	const page = exactRecord(value, [
		"accountGeneration",
		"provider",
		"titleKey",
		"observedEpisodeCount",
		"completedEpisodeCount",
		"complete",
		"nextCursor",
		"progressRows",
		"catalog",
	]);
	assert.ok(Array.isArray(page.progressRows));
	assert.ok(page.progressRows.length <= 50);
	assert.equal(typeof page.complete, "boolean");
	assert.ok(page.nextCursor === null || typeof page.nextCursor === "string");
	assert.equal(typeof page.accountGeneration, "number");
	if (typeof page.nextCursor === "string") {
		parseResourceEpisodeCursor(page.nextCursor, {
			userId: USER_ID,
			accountGeneration: page.accountGeneration as number,
			provider: page.provider as string,
			titleKey: page.titleKey as string,
		});
	}
	return page;
}

test("local RPC output passes the production parser and follows canonical clear generation", {
	skip:
		enabled || required ? false : "local RPC JSON contract is not configured",
}, async () => {
	assert.ok(localRpcJson, "local RPC JSON contract is required for this run");
	const values: unknown = JSON.parse(localRpcJson);
	assert.ok(Array.isArray(values));
	assert.ok(values.length >= 2);

	const firstPage = parseBoundedWatchHistoryPage(values[0]);
	assert.equal(firstPage.accountGeneration, 1);
	assert.ok(firstPage.progressRows.length >= 1);
	const firstResponse = buildWatchHistoryV3Response({
		userId: USER_ID,
		accountGeneration: firstPage.accountGeneration,
		progressRows: firstPage.progressRows,
		sessions: [],
		limit: 1,
		totalTitleCount: firstPage.totalTitleCount,
		hasMore: firstPage.hasMore,
		generatedAt: new Date(),
	});
	assert.deepEqual(
		firstResponse.items.map((item) => item.titleKey),
		["crunchyroll:series:local-rpc-title"],
	);

	const afterClear = parseBoundedWatchHistoryPage(values[1]);
	assert.equal(afterClear.accountGeneration, 2);
	assert.deepEqual(afterClear.progressRows, []);
	assert.equal(afterClear.totalTitleCount, 0);
});

test("local bounded RPC output is strict, capped, counted, and cursor-pageable", {
	skip:
		enabled || required ? false : "local RPC JSON contract is not configured",
}, () => {
	assert.ok(localRpcJson, "local RPC JSON contract is required for this run");
	const values: unknown = JSON.parse(localRpcJson);
	assert.ok(Array.isArray(values));
	assert.equal(values.length, 5);

	const titlePage = parseResourceTitlePage(values[2]);
	assert.equal(titlePage.accountGeneration, 1);
	assert.equal(titlePage.totalTitleCount, 1);
	assert.equal((titlePage.progressRows as unknown[]).length, 8);
	const titleSummary = (titlePage.titleSummaries as RecordValue[])[0];
	assert.equal(titleSummary?.observedEpisodeCount, 12);
	assert.equal(titleSummary?.completedEpisodeCount, 6);

	const detailOne = parseResourceDetailPage(values[3]);
	const detailTwo = parseResourceDetailPage(values[4]);
	assert.equal((detailOne.progressRows as unknown[]).length, 7);
	assert.equal(detailOne.complete, false);
	assert.equal((detailTwo.progressRows as unknown[]).length, 5);
	assert.equal(detailTwo.complete, true);

	const identities = [
		...(detailOne.progressRows as RecordValue[]),
		...(detailTwo.progressRows as RecordValue[]),
	].map((row) => row.episode_key);
	assert.equal(new Set(identities).size, 12);

	assert.throws(() => parseResourceTitlePage({ ...titlePage, unknown: true }));
	assert.throws(() => parseResourceDetailPage({ ...detailOne, unknown: true }));
});
