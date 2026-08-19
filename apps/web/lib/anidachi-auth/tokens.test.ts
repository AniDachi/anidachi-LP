import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRefreshTokenResolutionResult,
  parseRefreshTokenRotationResult,
} from "./db";
import { deriveRefreshTokenSuccessor } from "./tokens";

async function withJwtSecret<T>(fn: () => Promise<T>): Promise<T> {
  const previous = process.env.ANIDACHI_JWT_SECRET;
  process.env.ANIDACHI_JWT_SECRET = "test-secret-for-anidachi-jwt-bridge";
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.ANIDACHI_JWT_SECRET;
    else process.env.ANIDACHI_JWT_SECRET = previous;
  }
}

test("rotated refresh successors use the centralized domain-separated HMAC format", async () => {
  await withJwtSecret(async () => {
    assert.equal(
      deriveRefreshTokenSuccessor("presented-refresh-token", "website"),
      "NEmkeRHY34mcRsBuZG4vq-BRSWQJD6dWmrPbIOJe8A8",
    );
    assert.equal(
      deriveRefreshTokenSuccessor("presented-refresh-token", "extension"),
      "Vvp9wEE_cciTh61DOzCw5gBBGA_CShj2vyTdGSi7tZ4",
    );
  });
});

test("the same predecessor and channel always derive the same opaque successor", async () => {
  await withJwtSecret(async () => {
    const first = deriveRefreshTokenSuccessor("predecessor", "website");
    const second = deriveRefreshTokenSuccessor("predecessor", "website");
    assert.equal(first, second);
    assert.match(first, /^[A-Za-z0-9_-]{43}$/u);
    assert.notEqual(first, deriveRefreshTokenSuccessor("predecessor", "extension"));
    assert.notEqual(first, deriveRefreshTokenSuccessor("other-predecessor", "website"));
  });
});

test("refresh resolution accepts only null or one canonical UUID", () => {
  const userId = "70000000-0000-4000-8000-000000000002";

  assert.equal(parseRefreshTokenResolutionResult(null), null);
  assert.equal(parseRefreshTokenResolutionResult(userId), userId);

  for (const result of [
    undefined,
    "",
    "not-a-uuid",
    [],
    [userId],
    {},
    { user_id: userId },
  ]) {
    assert.throws(
      () => parseRefreshTokenResolutionResult(result),
      /Malformed refresh token resolution response/,
    );
  }
});

test("refresh rotation accepts exactly one coherent typed RPC row", () => {
  const familyId = "70000000-0000-4000-8000-000000000001";
  const userId = "70000000-0000-4000-8000-000000000002";

  assert.deepEqual(
    parseRefreshTokenRotationResult([
      { rotation_outcome: "rotated", user_id: userId, family_id: familyId },
    ]),
    { rotation_outcome: "rotated", user_id: userId, family_id: familyId },
  );
  assert.deepEqual(
    parseRefreshTokenRotationResult([
      { rotation_outcome: "reused", user_id: userId, family_id: familyId },
    ]),
    { rotation_outcome: "reused", user_id: userId, family_id: familyId },
  );
  assert.deepEqual(
    parseRefreshTokenRotationResult([
      { rotation_outcome: "invalid", user_id: null, family_id: null },
    ]),
    { rotation_outcome: "invalid", user_id: null, family_id: null },
  );
  assert.deepEqual(
    parseRefreshTokenRotationResult([
      { rotation_outcome: "invalid", user_id: null, family_id: familyId },
    ]),
    { rotation_outcome: "invalid", user_id: null, family_id: familyId },
  );
  assert.deepEqual(
    parseRefreshTokenRotationResult([
      { rotation_outcome: "replayed", user_id: null, family_id: familyId },
    ]),
    { rotation_outcome: "replayed", user_id: null, family_id: familyId },
  );
});

test("refresh rotation rejects absent, ambiguous, malformed, or unknown successful RPC data", () => {
  const familyId = "70000000-0000-4000-8000-000000000001";
  const userId = "70000000-0000-4000-8000-000000000002";
  const invalidResults: unknown[] = [
    null,
    [],
    [
      { rotation_outcome: "invalid", user_id: null, family_id: null },
      { rotation_outcome: "invalid", user_id: null, family_id: null },
    ],
    [{ rotation_outcome: "unknown", user_id: null, family_id: null }],
    [{ rotation_outcome: "rotated", user_id: null, family_id: familyId }],
    [{ rotation_outcome: "reused", user_id: userId, family_id: null }],
    [{ rotation_outcome: "replayed", user_id: userId, family_id: familyId }],
    [{ rotation_outcome: "invalid", user_id: null }],
    [{ rotation_outcome: "invalid", user_id: null, family_id: null, extra: true }],
  ];

  for (const result of invalidResults) {
    assert.throws(
      () => parseRefreshTokenRotationResult(result),
      /Malformed refresh token rotation response/,
    );
  }
});
