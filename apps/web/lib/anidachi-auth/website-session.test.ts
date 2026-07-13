import assert from "node:assert/strict";
import test from "node:test";
import { resolveWebsiteSession } from "./website-session";

const user = {
  id: "user-1",
  email: "user@example.com",
  displayName: "Alina",
  avatarUrl: null,
  plan: "plus" as const,
};

test("website session resolves from a valid refresh token without rotating it", async () => {
  const result = await resolveWebsiteSession("website-refresh", {
    validateRefreshToken: async (token) => {
      assert.equal(token, "website-refresh");
      return "user-1";
    },
    getUserProfile: async (userId) => {
      assert.equal(userId, "user-1");
      return user;
    },
  });

  assert.deepEqual(result, user);
});

test("website session rejects missing, expired, and orphaned refresh tokens", async () => {
  const dependencies = {
    validateRefreshToken: async (token: string) =>
      token === "expired" ? null : "missing-user",
    getUserProfile: async () => null,
  };

  assert.equal(await resolveWebsiteSession(undefined, dependencies), null);
  assert.equal(await resolveWebsiteSession("expired", dependencies), null);
  assert.equal(await resolveWebsiteSession("valid", dependencies), null);
});
