import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildWatchHistoryV2Response,
  parseBoundedWatchHistoryPage,
} from "./watch-history-v2";

const benchmarkFile = process.env.WATCH_HISTORY_BENCHMARK_JSON;

test("realistic large-account RPC page has measured parser and payload evidence", {
  skip: benchmarkFile ? false : "benchmark JSON is not configured",
}, async () => {
  const raw = await readFile(benchmarkFile!, "utf8");
  const beforeRss = process.memoryUsage().rss;
  const page = parseBoundedWatchHistoryPage(JSON.parse(raw));
  const response = buildWatchHistoryV2Response({
    userId: "77777777-7777-4777-8777-777777777777",
    accountGeneration: page.accountGeneration,
    progressRows: page.progressRows,
    sessions: [],
    limit: 50,
    totalTitleCount: page.totalTitleCount,
    hasMore: page.hasMore,
    generatedAt: new Date(),
  });
  const afterRss = process.memoryUsage().rss;

  assert.equal(page.totalTitleCount, 501);
  assert.equal(page.progressRows.length, 2_376);
  assert.equal(page.sessionIds.length, 20);
  assert.equal(response.items.length, 50);
  assert.equal(response.nextCursor === null, false);
  console.log(JSON.stringify({
    payloadBytes: Buffer.byteLength(raw),
    progressRows: page.progressRows.length,
    sessionIds: page.sessionIds.length,
    responseItems: response.items.length,
    rssBeforeBytes: beforeRss,
    rssAfterBytes: afterRss,
    rssDeltaBytes: afterRss - beforeRss,
  }));
});
