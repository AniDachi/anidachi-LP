import assert from "node:assert/strict";
import test from "node:test";
import {
  FREE_PLAN_CODE,
  PAID_PLAN_CODES,
  checkoutInputToPaidPlanCode,
  isCanonicalPlanCode,
  isPaidPlanCode,
  normalizePaidPlanCode,
  normalizePlanCode,
} from "./plan-codes";

test("normalizes old plan codes to canonical plan codes", () => {
  assert.equal(normalizePlanCode("watcher"), "free");
  assert.equal(normalizePlanCode("nakama"), "plus");
  assert.equal(normalizePlanCode("junkie"), "pro");
});

test("accepts canonical plan codes unchanged", () => {
  assert.equal(normalizePlanCode("free"), "free");
  assert.equal(normalizePlanCode("plus"), "plus");
  assert.equal(normalizePlanCode("pro"), "pro");
});

test("defaults unknown plan values to free", () => {
  assert.equal(FREE_PLAN_CODE, "free");
  assert.equal(normalizePlanCode("unknown"), "free");
  assert.equal(normalizePlanCode(null), "free");
});

test("paid plan parser rejects free and accepts plus/pro legacy aliases", () => {
  assert.deepEqual(PAID_PLAN_CODES, ["plus", "pro"]);
  assert.equal(normalizePaidPlanCode("plus"), "plus");
  assert.equal(normalizePaidPlanCode("pro"), "pro");
  assert.equal(normalizePaidPlanCode("nakama"), "plus");
  assert.equal(normalizePaidPlanCode("junkie"), "pro");
  assert.equal(normalizePaidPlanCode("free"), null);
  assert.equal(normalizePaidPlanCode("watcher"), null);
});

test("checkout parser keeps legacy public tier ids as bridge inputs", () => {
  assert.equal(checkoutInputToPaidPlanCode({ planCode: "plus" }), "plus");
  assert.equal(checkoutInputToPaidPlanCode({ planCode: "pro" }), "pro");
  assert.equal(checkoutInputToPaidPlanCode({ planCode: "nakama" }), "plus");
  assert.equal(checkoutInputToPaidPlanCode({ planCode: "junkie" }), "pro");
  assert.equal(checkoutInputToPaidPlanCode({ tier: "crunchyroll_subscriber" }), "plus");
  assert.equal(checkoutInputToPaidPlanCode({ tier: "anime_junkie" }), "pro");
  assert.equal(checkoutInputToPaidPlanCode({ planCode: "free" }), null);
});

test("type guards only expose canonical names", () => {
  assert.equal(isCanonicalPlanCode("free"), true);
  assert.equal(isCanonicalPlanCode("watcher"), false);
  assert.equal(isPaidPlanCode("plus"), true);
  assert.equal(isPaidPlanCode("nakama"), false);
});
