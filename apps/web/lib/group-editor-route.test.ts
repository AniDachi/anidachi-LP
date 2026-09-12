import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest, NextResponse } from "next/server";
import { createGroupEditorHandler } from "./anidachi-auth/group-editor-route";
import { SOCIAL_OWNER_HEADER } from "./social-editor-contracts";
const owner = "11111111-1111-4111-8111-111111111111";
const group = "22222222-2222-4222-8222-222222222222";
const member = "33333333-3333-4333-8333-333333333333";
const body = {
  groupId: group,
  name: " Anime night ",
  memberIds: [member, member],
  create: true,
};
const session = {
  userId: owner,
  email: "alex@example.invalid",
  plan: "plus" as const,
  source: "cookie" as const,
};
function req(header?: string) {
  return new NextRequest("https://staging.anidachi.app/api/groups/editor", {
    method: "POST",
    headers: header ? { [SOCIAL_OWNER_HEADER]: header } : {},
  });
}
test("editor owner fence runs before reading payload or writing", async () => {
  let reads = 0,
    writes = 0;
  const post = createGroupEditorHandler({
    getSession: async () => session,
    readBody: async () => {
      reads++;
      return body;
    },
    saveGroup: async () => {
      writes++;
      throw Error("Unexpected write");
    },
    errorResponse: () => NextResponse.json({}, { status: 500 }),
  });
  assert.equal((await post(req("different-owner"))).status, 409);
  assert.equal((await post(req())).status, 409);
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});
test("editor rejects malformed payloads and missing edit revisions without mutation", async () => {
  for (const input of [
    null,
    [],
    { ...body, memberIds: ["invalid"] },
    { ...body, create: false },
    { ...body, name: "" },
    { ...body, memberIds: Array(101).fill(member) },
  ]) {
    const post = createGroupEditorHandler({
      getSession: async () => session,
      readBody: async () => input,
      saveGroup: async () => {
        throw Error("Unexpected write");
      },
      errorResponse: () => NextResponse.json({}, { status: 500 }),
    });
    assert.equal((await post(req(owner))).status, 400);
  }
});
test("editor resolves the owner from authentication and saves deduplicated membership in one call", async () => {
  let count = 0;
  const post = createGroupEditorHandler({
    getSession: async () => session,
    readBody: async () => ({ ...body, ownerUserId: "attacker" }),
    saveGroup: async (input) => {
      count++;
      assert.deepEqual(input, {
        ownerUserId: owner,
        groupId: group,
        name: "Anime night",
        memberIds: [member],
        create: true,
        expectedUpdatedAt: null,
      });
      return {
        id: group,
        name: input.name,
        members: [],
        archivedAt: null,
        createdAt: "2026-09-11T00:00:00Z",
        updatedAt: "2026-09-11T00:00:00Z",
      };
    },
    errorResponse: () => NextResponse.json({}, { status: 500 }),
  });
  assert.equal((await post(req(owner))).status, 200);
  assert.equal(count, 1);
});
