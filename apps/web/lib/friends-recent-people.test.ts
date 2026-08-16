import assert from "node:assert/strict";
import test from "node:test";
import { formatRecentMeta } from "../app/friends/friends-client";

test("Friends recent people describe when users watched without inventing a room count", () => {
  const lastWatchedAt = "2026-08-07T12:00:00.000Z";
  const label = formatRecentMeta({
    user: {
      userId: "11111111-1111-4111-8111-111111111111",
      handle: "ren",
      displayName: "Ren",
      avatarUrl: null,
    },
    lastWatchedAt,
  });

  const expectedDate = new Date(lastWatchedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  assert.equal(label, `Watched ${expectedDate}`);
  assert.doesNotMatch(label, /room/i);
});
