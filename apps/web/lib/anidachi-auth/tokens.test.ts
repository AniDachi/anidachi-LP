import assert from "node:assert/strict";
import test from "node:test";
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
