import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const benchmarkFile = process.env.WATCH_HISTORY_BENCHMARK_JSON;
const benchmarkRequired = process.env.WATCH_HISTORY_REQUIRE_BENCHMARK === "1";

function exactRecord(value: unknown, keys: string[]): Record<string, unknown> {
	assert.ok(
		value !== null && typeof value === "object" && !Array.isArray(value),
	);
	const record = value as Record<string, unknown>;
	assert.deepEqual(Object.keys(record).sort(), [...keys].sort());
	return record;
}

function parseResourceBenchmarkPage(value: unknown) {
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
		exactRecord(summary.episodePage, ["complete", "nextCursor"]);
	}
	return page;
}

test("realistic large-account RPC page has measured parser and payload evidence", {
	skip:
		benchmarkFile || benchmarkRequired
			? false
			: "benchmark JSON is not configured",
}, async () => {
	assert.ok(benchmarkFile, "benchmark JSON is required for this run");
	const raw = await readFile(benchmarkFile, "utf8");
	const beforeRss = process.memoryUsage().rss;
	const page = parseResourceBenchmarkPage(JSON.parse(raw));
	const afterRss = process.memoryUsage().rss;

	assert.equal(page.totalTitleCount, 501);
	assert.equal(page.hasMore, true);
	assert.equal((page.titleSummaries as unknown[]).length, 100);
	assert.equal((page.progressRows as unknown[]).length, 800);
	assert.equal((page.sessionIds as unknown[]).length, 20);
	assert.ok(Buffer.byteLength(raw) <= 4 * 1024 * 1024);
	assert.ok(afterRss - beforeRss < 32 * 1024 * 1024);
	console.log(
		JSON.stringify({
			payloadBytes: Buffer.byteLength(raw),
			progressRows: (page.progressRows as unknown[]).length,
			sessionIds: (page.sessionIds as unknown[]).length,
			titleSummaries: (page.titleSummaries as unknown[]).length,
			rssBeforeBytes: beforeRss,
			rssAfterBytes: afterRss,
			rssDeltaBytes: afterRss - beforeRss,
		}),
	);
});
