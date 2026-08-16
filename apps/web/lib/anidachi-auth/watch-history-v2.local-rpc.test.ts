import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWatchHistoryV2Response,
  parseBoundedWatchHistoryPage,
} from "./watch-history-v2";

const localRpcJson = process.env.WATCH_HISTORY_LOCAL_RPC_JSON;
const enabled = Boolean(localRpcJson);
const USER_ID = "66666666-6666-4666-8666-666666666666";

test("local RPC output passes the production parser and follows canonical clear generation", {
  skip: enabled ? false : "local RPC JSON contract is not configured",
}, async () => {
  const values: unknown = JSON.parse(localRpcJson!);
  assert.ok(Array.isArray(values));
  assert.equal(values.length, 2);

  const firstPage = parseBoundedWatchHistoryPage(values[0]);
  assert.equal(firstPage.accountGeneration, 1);
  assert.equal(firstPage.progressRows.length, 1);
  const firstResponse = buildWatchHistoryV2Response({
    userId: USER_ID,
    accountGeneration: firstPage.accountGeneration,
    progressRows: firstPage.progressRows,
    sessions: [],
    limit: 1,
    totalTitleCount: firstPage.totalTitleCount,
    hasMore: firstPage.hasMore,
    generatedAt: new Date(),
  });
  assert.deepEqual(firstResponse.items.map((item) => item.titleKey), ["local-rpc-title"]);

  const afterClear = parseBoundedWatchHistoryPage(values[1]);
  assert.equal(afterClear.accountGeneration, 2);
  assert.deepEqual(afterClear.progressRows, []);
  assert.equal(afterClear.totalTitleCount, 0);
});
