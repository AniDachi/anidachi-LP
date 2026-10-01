import assert from "node:assert/strict";
import test from "node:test";
import { serverSnapshotRemainingMs } from "./server-snapshot-age";

test("server snapshot lease counts time before hydration and never restarts on a revisit", () => {
  assert.equal(serverSnapshotRemainingMs(60_000, 5_000), 55_000);
  assert.equal(serverSnapshotRemainingMs(1_000, 1_200), 0);
  assert.equal(serverSnapshotRemainingMs(60_000, 90_000), 0);
  assert.equal(serverSnapshotRemainingMs(Infinity, 0), 0);
  assert.equal(serverSnapshotRemainingMs(60_000, -1), 0);
});
