import type { AccountInboxResponse } from "@anidachi/protocol";
import { describe, expect, it, vi } from "vitest";
import {
  applicationServerKeyMatches,
  buildInboxNotificationPlan,
  normalizeRememberedInboxItems,
  openRoomInviteNotificationDestination,
  parseInboxChangedPushPayload,
  pruneRememberedInboxItemKeys,
} from "../src/room-invite-notifications";

const NOW = "2026-08-10T08:00:00.000Z";
const USER_ID = "11111111-1111-4111-8111-111111111111";

describe("inbox notification planning", () => {
  it("opens the action popup in the last focused normal Chrome window", async () => {
    const getLastFocusedWindow = vi.fn().mockResolvedValue({ id: 42 });
    const openPopup = vi.fn().mockResolvedValue(undefined);
    const openWebInbox = vi.fn().mockResolvedValue(undefined);

    await expect(
      openRoomInviteNotificationDestination({
        getLastFocusedWindow,
        openPopup,
        openWebInbox,
      }),
    ).resolves.toBe("popup");

    expect(getLastFocusedWindow).toHaveBeenCalledOnce();
    expect(openPopup).toHaveBeenCalledWith({ windowId: 42 });
    expect(openWebInbox).not.toHaveBeenCalled();
  });

  it("opens the web inbox only when Chrome cannot open the action popup", async () => {
    const openWebInbox = vi.fn().mockResolvedValue(undefined);

    await expect(
      openRoomInviteNotificationDestination({
        getLastFocusedWindow: vi.fn().mockResolvedValue({ id: 42 }),
        openPopup: vi.fn().mockRejectedValue(new Error("Popup unavailable")),
        openWebInbox,
      }),
    ).resolves.toBe("web");

    expect(openWebInbox).toHaveBeenCalledOnce();
  });

  it("uses direct and group copy without leaking private room data", () => {
    const direct = buildInboxNotificationPlan(inbox([roomInvite("invite-a", "direct")]));
    expect(direct).toEqual({
      title: "Host invited you to watch together",
      message: "Open AniDachi to view the invitation.",
      itemKeys: ["room-invite:invite-a"],
    });

    const group = buildInboxNotificationPlan(inbox([roomInvite("invite-b", "group")]));
    expect(group).toEqual({
      title: "Host invited you to watch with a group",
      message: "Open AniDachi to view the invitation.",
      itemKeys: ["room-invite:invite-b"],
    });
  });

  it("notifies for a new friend request without exposing private inbox data", () => {
    const plan = buildInboxNotificationPlan(inbox([friendRequest("friendship-a")]));

    expect(plan).toEqual({
      title: "Friend sent you a friend request",
      message: "Open AniDachi to respond.",
      itemKeys: ["friend-request:friendship-a"],
    });
  });

  it("aggregates mixed unseen invitations into one system alert", () => {
    const plan = buildInboxNotificationPlan(
      inbox([
        roomInvite("invite-a", "direct"),
        friendRequest("friendship-a"),
        roomInvite("invite-b", "group", "missed"),
      ]),
    );

    expect(plan).toEqual({
      title: "3 new invitations",
      message: "Open AniDachi to view them.",
      itemKeys: [
        "room-invite:invite-a",
        "friend-request:friendship-a",
        "room-invite:invite-b",
      ],
    });
  });

  it("uses neutral copy for a missed room invite", () => {
    const plan = buildInboxNotificationPlan(
      inbox([roomInvite("invite-missed", "direct", "missed")]),
    );

    expect(plan).toEqual({
      title: "You missed a watch invitation from Host",
      message: "Open AniDachi to view it.",
      itemKeys: ["room-invite:invite-missed"],
    });
  });

  it("does not notify twice and prunes resolved inbox item keys", () => {
    const current = inbox([
      roomInvite("invite-a", "direct"),
      friendRequest("friendship-a"),
    ]);
    expect(
      buildInboxNotificationPlan(current, [
        "room-invite:invite-a",
        "friend-request:friendship-a",
      ]),
    ).toBeNull();
    expect(
      pruneRememberedInboxItemKeys(current, [
        "room-invite:invite-a",
        "friend-request:friendship-a",
        "room-invite:invite-old",
      ]),
    ).toEqual(["room-invite:invite-a", "friend-request:friendship-a"]);
  });

  it("preserves room-invite dedupe when an existing profile upgrades", () => {
    expect(
      normalizeRememberedInboxItems(
        { userId: USER_ID, inviteIds: ["invite-a", "invite-b"] },
        USER_ID,
      ),
    ).toEqual({
      userId: USER_ID,
      itemKeys: ["room-invite:invite-a", "room-invite:invite-b"],
    });
  });

  it("aggregates all current unseen invitations when a later invite arrives", () => {
    const plan = buildInboxNotificationPlan(
      inbox([roomInvite("invite-a", "direct"), roomInvite("invite-b", "group")]),
      ["room-invite:invite-a"],
    );

    expect(plan).toEqual({
      title: "2 watch invitations",
      message: "Open AniDachi to view them.",
      itemKeys: ["room-invite:invite-a", "room-invite:invite-b"],
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
