import assert from "node:assert/strict";
import test from "node:test";
import { loadBillingSnapshot } from "./billing-snapshot";
import type { BillingOverview } from "../billing-view";

test("billing bootstrap never reads a snapshot for a revoked or different website session", async () => {
  let reads = 0;
  for (const user of [null, { id: "other" }]) {
    assert.equal(await loadBillingSnapshot("owner", {
      websiteUser: async () => user,
      overview: async () => { reads++; return {} as BillingOverview; },
    }), undefined);
  }
  assert.equal(reads, 0);
});
test("billing bootstrap preserves owner and deducts all server work from its lease", async () => {
  const overview = { ownerUserId: "owner", planCode: "free", subscriptions: [], serverTime: "2030-01-01T00:00:00Z" } as BillingOverview;
  let now = 0;
  const result = await loadBillingSnapshot("owner", {
    websiteUser: async () => { now += 20; return { id: "owner" }; },
    overview: async () => { now += 30; return overview; },
    now: () => now,
  });
  assert.equal(result?.remainingMs, 59_950);
  assert.equal(result?.overview, overview);
});
