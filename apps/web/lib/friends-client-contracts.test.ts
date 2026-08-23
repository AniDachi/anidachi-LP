import assert from "node:assert/strict";
import test from "node:test";
import { parseRecentPeopleResponse } from "./friends-client-contracts";

const NOW = "2026-08-08T12:00:00.000Z";
const USER_ID = "00000000-0000-4000-8000-000000000001";

test("recent people success responses are runtime validated", () => {
  const response = parseRecentPeopleResponse({
    meta: { serverTime: NOW, schemaVersion: 1 },
    people: [
      {
        user: {
          userId: USER_ID,
          handle: "viewer",
          displayName: "Viewer",
          avatarUrl: null,
        },
        lastWatchedAt: NOW,
      },
    ],
  });

  assert.equal(response.people[0]?.user.userId, USER_ID);
});

test("malformed recent people success responses become the safe account error", () => {
  assert.throws(
    () => parseRecentPeopleResponse({ meta: null, people: [{ user: { userId: "bad" } }] }),
    /Account data is temporarily unavailable\. Try again\./,
  );
});
