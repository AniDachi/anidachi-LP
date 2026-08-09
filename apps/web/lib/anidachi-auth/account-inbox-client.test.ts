import assert from "node:assert/strict";
import test from "node:test";
import type { AccountInboxResponse } from "@anidachi/protocol";
import {
  accountInboxSeenItems,
  appendAccountInboxPage,
  applyAccountInboxSeenAcknowledgement,
  parseOwnedAccountInboxResponse,
} from "./account-inbox-client";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const FRIENDSHIP_ID = "33333333-3333-4333-8333-333333333333";
const NOW = "2026-08-09T12:00:00.000Z";

test("parseOwnedAccountInboxResponse accepts only the active account owner", () => {
  const response = inboxResponse(OWNER_ID);

  assert.deepEqual(parseOwnedAccountInboxResponse(response, OWNER_ID), response);
  assert.throws(
    () => parseOwnedAccountInboxResponse(response, OTHER_ID),
    /belongs to another account/,
  );
});

test("accountInboxSeenItems includes only items that have not been acknowledged", () => {
  const response = inboxResponse(OWNER_ID);
  const friendRequest = response.items[0] as Extract<
    AccountInboxResponse["items"][number],
    { kind: "friend-request" }
  >;
  response.items.push({
    ...friendRequest,
    friendshipId: OTHER_ID,
    seenAt: NOW,
  });

  assert.deepEqual(accountInboxSeenItems(response), [
    { kind: "friend-request", id: FRIENDSHIP_ID },
  ]);
});

test("applyAccountInboxSeenAcknowledgement keeps the requested page and clears its unseen items", () => {
  const page = inboxResponse(OWNER_ID);
  page.nextCursor = "next-page";
  const acknowledgement = {
    ...inboxResponse(OWNER_ID),
    items: [],
    counts: { ...page.counts, unseen: 0 },
  };

  const result = applyAccountInboxSeenAcknowledgement(page, acknowledgement);

  assert.equal(result.items[0]?.seenAt, NOW);
  assert.equal(result.counts.unseen, 0);
  assert.equal(result.nextCursor, "next-page");
});

test("appendAccountInboxPage preserves order and removes duplicate boundary items", () => {
  const current = inboxResponse(OWNER_ID);
  current.nextCursor = "next-page";
  const page = inboxResponse(OWNER_ID);
  page.items.push({
    ...(page.items[0] as Extract<
      AccountInboxResponse["items"][number],
      { kind: "friend-request" }
    >),
    friendshipId: OTHER_ID,
  });
  page.nextCursor = null;

  const result = appendAccountInboxPage(current, page);

  assert.deepEqual(
    result.items.map((item) => (item.kind === "room-invite" ? item.inviteId : item.friendshipId)),
    [FRIENDSHIP_ID, OTHER_ID],
  );
  assert.equal(result.nextCursor, null);
});

function inboxResponse(ownerUserId: string): AccountInboxResponse {
  return {
    meta: { serverTime: NOW, schemaVersion: 1, ownerUserId },
    items: [
      {
        kind: "friend-request",
        friendshipId: FRIENDSHIP_ID,
        sender: {
          userId: OTHER_ID,
          handle: "friend",
          displayName: "Friend",
          avatarUrl: null,
        },
        state: "pending",
        createdAt: NOW,
        activityAt: NOW,
        seenAt: null,
      },
    ],
    counts: {
      unseen: 1,
      actionable: 1,
      activeRoomInvites: 0,
      pendingFriendRequests: 1,
    },
    nextCursor: null,
  };
}
