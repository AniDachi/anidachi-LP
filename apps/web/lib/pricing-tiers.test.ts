import assert from "node:assert/strict";
import { test } from "node:test";
import { getPlanPolicy } from "@anidachi/protocol";
import {
  PRICING_PLAN_MATRIX_ROWS,
  PRICING_TIERS,
  type PricingTierId,
} from "./pricing-tiers";

function valuesFor(feature: RegExp) {
  const rows = PRICING_PLAN_MATRIX_ROWS.filter((row) => feature.test(row.feature));
  assert.equal(rows.length, 1, `Expected one pricing row for ${feature}`);
  return rows[0]!.values;
}

test("saved history and resume stay available on Free after a paid plan ends", () => {
  assert.deepEqual(valuesFor(/resume/i), {
    free: "yes",
    plus: "yes",
    pro: "yes",
  });
});

test("recording and editing progress require the viewer's own paid plan", () => {
  const values = valuesFor(/record.*progress/i);
  assert.equal(values.free, "no");
  for (const tier of ["plus", "pro"] as const) {
    assert.match(values[tier]!, /^yes\b/i);
  }
});

test("published room limits and platform access match the active plan policies", () => {
  const people = valuesFor(/people in room/i);
  const cameras = valuesFor(/cameras at once/i);
  const microphones = valuesFor(/mics at once/i);
  const hosting = valuesFor(/host your own room/i);
  const platforms = valuesFor(/^platforms$/i);

  for (const tier of ["free", "plus", "pro"] satisfies PricingTierId[]) {
    const policy = getPlanPolicy(tier);
    assert.equal(people[tier], `Up to ${policy.maxParticipants}`);
    assert.equal(cameras[tier], `Up to ${policy.maxCameras}`);
    assert.equal(microphones[tier], `Up to ${policy.maxMicrophones}`);
    assert.equal(hosting[tier], policy.dailyHostSeconds === null
      ? "No daily limit"
      : `${policy.dailyHostSeconds / 60} min/day`);
    assert.equal(platforms[tier], "Crunchyroll + YouTube");
  }

  assert.deepEqual(PRICING_TIERS.map(({ id, priceDisplay }) => ({ id, priceDisplay })), [
    { id: "free", priceDisplay: "$0" },
    { id: "plus", priceDisplay: "$7.99" },
    { id: "pro", priceDisplay: "$14.99" },
  ]);
});
