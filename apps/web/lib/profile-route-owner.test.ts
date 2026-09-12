import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest, NextResponse } from "next/server";
import { PROFILE_OWNER_HEADER } from "./profile-owner";
import { createProfilePatchHandler } from "./anidachi-auth/profile-route";

const owner = "11111111-1111-4111-8111-111111111111";
const otherOwner = "22222222-2222-4222-8222-222222222222";

test("profile PATCH rejects a present mismatched owner before reading or mutating", async () => {
  let reads = 0;
  let mutations = 0;
  const patch = createProfilePatchHandler({
    getSession: async () => ({ userId: owner, email: "alex@example.com", plan: "free", source: "cookie" }),
    readBody: async () => { reads += 1; return {}; },
    updateProfile: async () => { mutations += 1; throw new Error("must not mutate"); },
    errorResponse: () => NextResponse.json({ error: "unexpected" }, { status: 500 }),
  });
  const request = new NextRequest("https://www.anidachi.app/api/me/profile", {
    method: "PATCH",
    headers: { [PROFILE_OWNER_HEADER]: otherOwner },
  });
  const response = await patch(request);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "Account changed. Refresh and try again." });
  assert.equal(reads, 0);
  assert.equal(mutations, 0);
});

test("profile PATCH keeps missing owner header compatibility", async () => {
  let mutations = 0;
  const patch = createProfilePatchHandler({
    getSession: async () => ({ userId: owner, email: "alex@example.com", plan: "free", source: "cookie" }),
    readBody: async () => ({ displayName: "Alex" }),
    updateProfile: async (input) => {
      mutations += 1;
      assert.equal(input.userId, owner);
      return { userId: owner, displayName: "Alex", handle: null, avatarUrl: null };
    },
    errorResponse: () => NextResponse.json({ error: "unexpected" }, { status: 500 }),
  });
  const response = await patch(new NextRequest("https://www.anidachi.app/api/me/profile", { method: "PATCH" }));
  assert.equal(response.status, 200);
  assert.equal(mutations, 1);
  assert.deepEqual(await response.json(), { profile: { userId: owner, displayName: "Alex", handle: null, avatarUrl: null } });
});
