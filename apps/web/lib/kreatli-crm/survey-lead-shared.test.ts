import assert from "node:assert/strict";
import test from "node:test";
import {
  REFERRAL_BUMP_SPOTS,
  buildReferralJoinUrl,
  effectiveWaitlistPositionForEmail,
  generateRefCode,
  getReferralCount,
  setReferralCount,
  waitlistPositionForEmail,
  withRefCodeSegment,
} from "./survey-lead-shared";
import type { Contact } from "./types";

function makeLead(
  email: string,
  createdAt: string,
  extraSegments: string[] = [],
): Contact {
  const id = `00000000-0000-4000-8000-${createdAt.padStart(12, "0")}`;
  return {
    id,
    email,
    company: "",
    first_name: "",
    segments: ["survey_lead", ...extraSegments],
    notes: "",
    status: "active",
    next_action_date: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

test("generateRefCode is stable and lowercase", () => {
  const id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  assert.equal(generateRefCode(id), "a1b2c3d4");
});

test("withRefCodeSegment adds ref_code once", () => {
  const id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const once = withRefCodeSegment(["survey_lead"], id);
  const twice = withRefCodeSegment(once, id);
  assert.equal(once.filter((s) => s.startsWith("ref_code:")).length, 1);
  assert.deepEqual(once, twice);
});

test("effective position drops 10 spots per referral", () => {
  const contacts = [
    makeLead("first@example.com", "2026-01-01T00:00:00.000Z"),
    makeLead("second@example.com", "2026-01-02T00:00:00.000Z", [
      "ref_code:abc12345",
      "referrals:1",
    ]),
    makeLead("third@example.com", "2026-01-03T00:00:00.000Z"),
  ];

  assert.equal(waitlistPositionForEmail(contacts, "second@example.com"), 2);
  assert.equal(
    effectiveWaitlistPositionForEmail(contacts, "second@example.com"),
    Math.max(1, 2 - REFERRAL_BUMP_SPOTS),
  );
});

test("effective position floors at 1", () => {
  const contacts = [
    makeLead("late@example.com", "2026-06-01T00:00:00.000Z", [
      "ref_code:zzz99999",
      `referrals:20`,
    ]),
  ];
  assert.equal(
    effectiveWaitlistPositionForEmail(contacts, "late@example.com"),
    1,
  );
});

test("setReferralCount replaces prior value", () => {
  assert.deepEqual(setReferralCount(["referrals:1"], 2), [
    "referrals:2",
  ]);
  assert.equal(getReferralCount(["referrals:3"]), 3);
});

test("buildReferralJoinUrl uses join path and ref query", () => {
  const url = buildReferralJoinUrl("https://www.anidachi.app", "abc12def");
  assert.equal(url, "https://www.anidachi.app/join?ref=abc12def");
});
