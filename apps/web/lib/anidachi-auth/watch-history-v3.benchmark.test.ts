import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WatchHistoryResponseSchema } from "@anidachi/protocol";
import {
	buildWatchHistoryV3Response,
	parseBoundedWatchHistoryPage,
} from "./watch-history-v3";

const benchmarkFile = process.env.WATCH_HISTORY_BENCHMARK_JSON;
const benchmarkRequired = process.env.WATCH_HISTORY_REQUIRE_BENCHMARK === "1";

test("realistic large-account RPC page has measured production parser and builder evidence", {
	skip:
		benchmarkFile || benchmarkRequired
			? false
			: "benchmark JSON is not configured",
}, async () => {
	assert.ok(benchmarkFile, "benchmark JSON is required for this run");
	const raw = await readFile(benchmarkFile, "utf8");
	const beforeRss = process.memoryUsage().rss;
	const page = parseBoundedWatchHistoryPage(JSON.parse(raw));
	const firstRow = page.progressRows[0] as Record<string, unknown> | undefined;
	assert.equal(typeof firstRow?.user_id, "string");
	const response = WatchHistoryResponseSchema.parse(buildWatchHistoryV3Response({
		userId: firstRow!.user_id as string,
		accountGeneration: page.accountGeneration,
		progressRows: page.progressRows,
		sessions: [],
		limit: 100,
		totalTitleCount: page.totalTitleCount,
		hasMore: page.hasMore,
		titleSummaries: page.titleSummaries,
		generatedAt: new Date("2026-09-05T00:00:00.000Z"),
	}));
	const afterRss = process.memoryUsage().rss;

	assert.equal(page.totalTitleCount, 501);
	assert.equal(page.hasMore, true);
	assert.equal(page.titleSummaries.length, 100);
	assert.equal(page.progressRows.length, 800);
	assert.equal(page.sessionIds.length, 20);
	assert.equal(response.items.length, 100);
	assert.equal(response.nextCursor === null, false);
	assert.ok(Buffer.byteLength(raw) <= 4 * 1024 * 1024);
	assert.ok(afterRss - beforeRss < 32 * 1024 * 1024);
	console.log(
		JSON.stringify({
			payloadBytes: Buffer.byteLength(raw),
			progressRows: page.progressRows.length,
			sessionIds: page.sessionIds.length,
			titleSummaries: page.titleSummaries.length,
			responseItems: response.items.length,
			rssBeforeBytes: beforeRss,
			rssAfterBytes: afterRss,
			rssDeltaBytes: afterRss - beforeRss,
		}),
	);
});
