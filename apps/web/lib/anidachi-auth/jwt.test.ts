import assert from "node:assert/strict";
import test from "node:test";
import { signAccessToken, verifyAccessToken } from "./jwt";

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

test("access tokens verify with canonical plan codes", async () => {
  await withJwtSecret(async () => {
    const token = await signAccessToken({
      sub: "user-1",
      email: "user@example.com",
      plan: "plus",
    });

    const payload = await verifyAccessToken(token);
    assert.equal(payload?.plan, "plus");
  });
});

test("access tokens normalize legacy plan codes during bridge window", async () => {
  await withJwtSecret(async () => {
    const token = await signAccessToken({
      sub: "user-1",
      email: "user@example.com",
      plan: "nakama" as never,
    });

    const payload = await verifyAccessToken(token);
    assert.equal(payload?.plan, "plus");
  });
});
