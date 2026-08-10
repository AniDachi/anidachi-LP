import type { AccountInboxResponse } from "@anidachi/protocol";
import { describe, expect, it } from "vitest";
import {
  applicationServerKeyMatches,
  buildRoomInviteNotificationPlan,
  parseInboxChangedPushPayload,
  pruneRememberedRoomInviteIds,
} from "../src/room-invite-notifications";

const NOW = "2026-08-10T08:00:00.000Z";
const USER_ID = "11111111-1111-4111-8111-111111111111";

describe("room invite notification planning", () => {
  it("uses direct and group copy without leaking private room data", () => {
    const direct = buildRoomInviteNotificationPlan(inbox([roomInvite("invite-a", "direct")]));
    expect(direct).toEqual({
      title: "Host invited you to watch together",
      message: "Open AniDachi to view the invitation.",
      inviteIds: ["invite-a"],
    });

    const group = buildRoomInviteNotificationPlan(inbox([roomInvite("invite-b", "group")]));
    expect(group).toEqual({
      title: "Host invited you to watch with a group",
      message: "Open AniDachi to view the invitation.",
      inviteIds: ["invite-b"],
    });
  });

  it("aggregates multiple unseen room invites and ignores friend requests", () => {
    const plan = buildRoomInviteNotificationPlan(
      inbox([
        roomInvite("invite-a", "direct"),
        friendRequest("friendship-a"),
        roomInvite("invite-b", "group", "missed"),
      ]),
    );

    expect(plan).toEqual({
      title: "2 watch invitations",
      message: "Open AniDachi to view them.",
      inviteIds: ["invite-a", "invite-b"],
    });
  });

  it("uses neutral copy for a missed room invite", () => {
    const plan = buildRoomInviteNotificationPlan(
      inbox([roomInvite("invite-missed", "direct", "missed")]),
    );

    expect(plan).toEqual({
      title: "You missed a watch invitation from Host",
      message: "Open AniDachi to view it.",
      inviteIds: ["invite-missed"],
    });
  });

  it("does not notify twice and prunes resolved invite ids", () => {
    const current = inbox([roomInvite("invite-a", "direct")]);
    expect(buildRoomInviteNotificationPlan(current, ["invite-a"])).toBeNull();
    expect(pruneRememberedRoomInviteIds(current, ["invite-a", "invite-old"])).toEqual([
      "invite-a",
    ]);
  });

  it("aggregates all current unseen invitations when a later invite arrives", () => {
    const plan = buildRoomInviteNotificationPlan(
      inbox([roomInvite("invite-a", "direct"), roomInvite("invite-b", "group")]),
      ["invite-a"],
    );

    expect(plan).toEqual({
      title: "2 watch invitations",
      message: "Open AniDachi to view them.",
      inviteIds: ["invite-a", "invite-b"],
    });
  });

  it("accepts only the minimal inbox invalidation payload", () => {
    expect(parseInboxChangedPushPayload(JSON.stringify({ type: "inbox_changed" }))).toEqual({
      type: "inbox_changed",
    });
    expect(
      parseInboxChangedPushPayload(
        JSON.stringify({ type: "inbox_changed", inviteId: "private-data" }),
      ),
    ).toBeNull();
    expect(parseInboxChangedPushPayload("not-json")).toBeNull();
  });

  it("detects VAPID key rotation before reusing a browser subscription", () => {
    expect(
      applicationServerKeyMatches(
        new Uint8Array([1, 2, 3]).buffer,
        new Uint8Array([1, 2, 3]).buffer,
      ),
    ).toBe(true);
    expect(
      applicationServerKeyMatches(
        new Uint8Array([1, 2, 3]).buffer,
        new Uint8Array([1, 2, 4]).buffer,
      ),
    ).toBe(false);
    expect(applicationServerKeyMatches(null, new Uint8Array([1]).buffer)).toBe(false);
  });
});

function inbox(items: AccountInboxResponse["items"]): AccountInboxResponse {
  return {
    meta: { serverTime: NOW, schemaVersion: 1, ownerUserId: USER_ID },
    items,
    counts: {
      unseen: items.filter((item) => item.seenAt === null).length,
      actionable: items.filter((item) => item.state !== "missed").length,
      activeRoomInvites: items.filter(
        (item) => item.kind === "room-invite" && item.state === "active",
      ).length,
      pendingFriendRequests: items.filter((item) => item.kind === "friend-request").length,
    },
    nextCursor: null,
  };
}

function roomInvite(
  inviteId: string,
  targetKind: "direct" | "group",
  state: "active" | "missed" = "active",
): Extract<AccountInboxResponse["items"][number], { kind: "room-invite" }> {
  const common = {
    kind: "room-invite" as const,
    inviteId,
    roomId: `room-${inviteId}`,
    sender: {
      userId: "22222222-2222-4222-8222-222222222222",
      handle: null,
      displayName: "Host",
      avatarUrl: null,
    },
    targetKind,
    targetGroupId:
      targetKind === "group" ? "33333333-3333-4333-8333-333333333333" : null,
    targetGroupName: targetKind === "group" ? "Friday crew" : null,
    message: "Private note",
    roomTitle: "Private room title",
    sourceUrl: "https://www.youtube.com/watch?v=private",
    videoFingerprint: "youtube:private",
    createdAt: NOW,
    activityAt: NOW,
    seenAt: null,
  };
  return state === "active"
    ? { ...common, state: "active", missedAt: null }
    : { ...common, state: "missed", missedAt: NOW };
}

function friendRequest(
  friendshipId: string,
): Extract<AccountInboxResponse["items"][number], { kind: "friend-request" }> {
  return {
    kind: "friend-request",
    friendshipId,
    sender: {
      userId: "44444444-4444-4444-8444-444444444444",
      handle: null,
      displayName: "Friend",
      avatarUrl: null,
    },
    state: "pending",
    createdAt: NOW,
    activityAt: NOW,
    seenAt: null,
  };
}
