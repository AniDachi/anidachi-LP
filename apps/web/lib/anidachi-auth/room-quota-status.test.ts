import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { ROOM_QUOTA_OWNER_HEADER } from "@anidachi/protocol";
import { createRoomQuotaStatusHandler } from "./room-quota-status";
import { computeQuotaView } from "../room-quota";

const owner = "11111111-1111-4111-8111-111111111111";
type Deps = Parameters<typeof createRoomQuotaStatusHandler>[0];
function harness() {
  let now = new Date("2026-09-15T23:59:59Z");
  let plan = "free";
  let used = 1800;
  let reads = 0;
  const deps: NonNullable<Deps> = {
    getSession: async () => ({ userId: owner, email: "test@example.invalid", plan: "free", source: "extension" }),
    resolve: async () => ({ policy: { planCode: plan } } as Awaited<ReturnType<NonNullable<Deps>["resolve"]>>),
    getQuota: async (_id, resolvedPlan, at) => { reads++; return computeQuotaView({ plan: resolvedPlan, persistedSecondsToday: used, now: at }); },
    now: () => now,
  };
  const request = (expected = owner) => new NextRequest("https://example.invalid/api/me/room-quota", { headers: { [ROOM_QUOTA_OWNER_HEADER]: expected, "x-client-time": "2099-01-01T00:00:00Z" } });
  return { deps, request, readCount: () => reads, set: (date: string, nextPlan = "free", seconds = 0) => { now = new Date(date); plan = nextPlan; used = seconds; } };
}
test("quota status uses server UTC and current entitlements without admitting or mutating a room", async () => {
  const h = harness(); const get = createRoomQuotaStatusHandler(h.deps);
  const first = await get(h.request());
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await first.json(), { schemaVersion: 1, ownerUserId: owner, serverTime: "2026-09-15T23:59:59.000Z", quota: { remainingSeconds: 0, resetAt: "2026-09-16T00:00:00.000Z" } });
  h.set("2026-09-16T00:00:00Z");
  assert.equal((await (await get(h.request())).json()).quota.remainingSeconds, 1800);
  h.set("2026-09-16T00:00:01Z", "pro", 1800);
  assert.equal((await (await get(h.request())).json()).quota, null);
});
test("quota status rejects anonymous and mismatched owners before reading usage", async () => {
  const h = harness();
  assert.equal((await createRoomQuotaStatusHandler(h.deps)(h.request("other-user"))).status, 409);
  h.deps.getSession = async () => null;
  assert.equal((await createRoomQuotaStatusHandler(h.deps)(h.request())).status, 401);
  assert.equal(h.readCount(), 0);
});
test("quota timestamps describe request reception even when authentication crosses midnight", async () => {
  const h = harness();
  const getSession = h.deps.getSession;
  h.deps.getSession = async request => {
    h.set("2026-09-16T00:00:01Z", "free", 1800);
    return getSession(request);
  };
  const response = await createRoomQuotaStatusHandler(h.deps)(h.request());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.serverTime, "2026-09-15T23:59:59.000Z");
  assert.equal(body.quota.resetAt, "2026-09-16T00:00:00.000Z");
});
test("quota status fails closed on unavailable authority or usage", async () => {
  const h = harness(); h.deps.getQuota = async () => { throw new Error("unavailable"); };
  const response = await createRoomQuotaStatusHandler(h.deps)(h.request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { code: "QUOTA_UNAVAILABLE" });
});
