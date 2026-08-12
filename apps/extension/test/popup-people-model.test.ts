import type {
  AccountInboxResponse,
  FriendGroup,
  FriendListItem,
  RecentPerson,
} from "@anidachi/protocol";
import { describe, expect, it } from "vitest";
import { buildPopupInboxModel, buildPopupPeopleModel } from "../src/popup-people-model";

const NOW = "2026-08-07T12:00:00.000Z";

describe("buildPopupPeopleModel", () => {
  it("deduplicates stable IDs and preserves the first server row order", () => {
    const model = buildPopupPeopleModel({
      friends: [
        friend("friend-a", "friendship-a", "friend-a", "accepted"),
        friend("friend-a", "friendship-a-duplicate", "friend-a", "accepted"),
        friend("friend-b", "friendship-b", "friend-b", "accepted"),
      ],
      incomingRequests: [
        friend("incoming-a", "incoming-a"),
        friend("incoming-a", "incoming-a-duplicate"),
      ],
      outgoingRequests: [
        friend("outgoing-a", "outgoing-a"),
        friend("outgoing-b", "outgoing-b"),
        friend("outgoing-a", "outgoing-a-duplicate"),
      ],
      groups: [
        group("group-a", null),
        group("group-a", null, "Group A duplicate"),
        group("group-b", null),
      ],
      recentPeople: [
        recent("recent-a"),
        recent("recent-a", "Recent duplicate"),
        recent("recent-b"),
      ],
    });

    expect(model.friends.map((item) => item.user.userId)).toEqual(["friend-a", "friend-b"]);
    expect([...model.incomingRequestUserIds]).toEqual(["incoming-a"]);
    expect([...model.outgoingRequestUserIds]).toEqual(["outgoing-a", "outgoing-b"]);
    expect(model.groups.map((item) => item.id)).toEqual(["group-a", "group-b"]);
    expect(model.recentPeople.map((item) => item.user.userId)).toEqual(["recent-a", "recent-b"]);
  });

  it("keeps only accepted friends and removes known relationships from recent people", () => {
    const model = buildPopupPeopleModel({
      friends: [
        friend("friend", "friendship", "Friend", "accepted"),
        friend("not-accepted", "pending-friendship", "Pending", "pending"),
      ],
      incomingRequests: [friend("incoming", "incoming")],
      outgoingRequests: [friend("outgoing", "outgoing")],
      groups: [],
      recentPeople: [recent("friend"), recent("incoming"), recent("outgoing"), recent("eligible")],
    });

    expect(model.friends.map((item) => item.user.userId)).toEqual(["friend"]);
    expect(model.recentPeople.map((item) => item.user.userId)).toEqual(["eligible"]);
  });

  it("excludes a recent person named by a non-accepted friends row", () => {
    const model = buildPopupPeopleModel({
      friends: [friend("stale-friend", "stale-friendship", "Stale Friend", "removed")],
      incomingRequests: [],
      outgoingRequests: [],
      groups: [],
      recentPeople: [recent("stale-friend"), recent("eligible")],
    });

    expect(model.friends).toEqual([]);
    expect(model.recentPeople.map((item) => item.user.userId)).toEqual(["eligible"]);
  });

  it("omits archived groups without changing the ordering of active groups", () => {
    const model = buildPopupPeopleModel({
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
      groups: [group("first", null), group("archived", NOW), group("last", null)],
      recentPeople: [],
    });

    expect(model.groups.map((item) => item.id)).toEqual(["first", "last"]);
  });

  it("exports request ID sets that cannot be mutated through a writable cast", () => {
    const model = buildPopupPeopleModel({
      friends: [],
      incomingRequests: [friend("incoming", "incoming")],
      outgoingRequests: [friend("outgoing", "outgoing")],
      groups: [],
      recentPeople: [],
    });

    expect(() => (model.incomingRequestUserIds as unknown as Set<string>).add("injected")).toThrow(
      TypeError,
    );
    expect(() =>
      (model.outgoingRequestUserIds as unknown as Set<string>).delete("outgoing"),
    ).toThrow(TypeError);
    expect([...model.incomingRequestUserIds]).toEqual(["incoming"]);
    expect([...model.outgoingRequestUserIds]).toEqual(["outgoing"]);
  });

  it("clones and freezes nested projections without mutating canonical input", () => {
    const sourceFriend = friend("friend", "friendship", "Friend", "accepted");
    const sourceGroup = group("group", null, "Group", ["Member"]);
    const sourceRecent = recent("recent", "Recent");
    const directory = {
      friends: [sourceFriend],
      incomingRequests: [],
      outgoingRequests: [],
      groups: [sourceGroup],
      recentPeople: [sourceRecent],
    };

    const model = buildPopupPeopleModel(directory);

    expect(() => {
      (model.friends[0] as FriendListItem).user.displayName = "Changed friend";
    }).toThrow(TypeError);
    expect(() => {
      (model.groups[0] as FriendGroup).members[0]!.user.displayName = "Changed member";
    }).toThrow(TypeError);
    expect(() => {
      (model.recentPeople[0] as RecentPerson).user.displayName = "Changed recent";
    }).toThrow(TypeError);

    expect(model.friends[0]?.user.displayName).toBe("Friend");
    expect(model.groups[0]?.members[0]?.user.displayName).toBe("Member");
    expect(model.recentPeople[0]?.user.displayName).toBe("Recent");
    expect(sourceFriend.user.displayName).toBe("Friend");
    expect(sourceGroup.members[0]?.user.displayName).toBe("Member");
    expect(sourceRecent.user.displayName).toBe("Recent");

    sourceFriend.user.displayName = "Canonical friend";
    sourceGroup.members[0]!.user.displayName = "Canonical member";
    sourceRecent.user.displayName = "Canonical recent";
    expect(model.friends[0]?.user.displayName).toBe("Friend");
    expect(model.groups[0]?.members[0]?.user.displayName).toBe("Member");
    expect(model.recentPeople[0]?.user.displayName).toBe("Recent");
  });
});

describe("buildPopupInboxModel", () => {
  it("projects canonical server order and both server-derived counts", () => {
    const response = accountInbox(
      [
        friendRequestItem(FRIENDSHIP_A, USER_A, "Incoming"),
        roomInviteItem(INVITE_A, "active"),
        roomInviteItem(INVITE_B, "missed"),
      ],
      {
        unseen: 3,
        actionable: 2,
        activeRoomInvites: 1,
        pendingFriendRequests: 1,
      },
    );
    const model = buildPopupInboxModel(response);
    expect(model).not.toBeNull();

    expect(model!.friendRequests.map((request) => request.friendshipId)).toEqual([FRIENDSHIP_A]);
    expect(model!.activeRoomInvites.map((invite) => invite.inviteId)).toEqual([INVITE_A]);
    expect(model!.missedRoomInvites.map((invite) => invite.inviteId)).toEqual([INVITE_B]);
    expect(model!.unseenCount).toBe(3);
    expect(model!.actionableCount).toBe(2);
  });

  it("does not independently reinterpret active or missed invite lifecycle", () => {
    const active = roomInviteItem(INVITE_A, "active");
    const missed = roomInviteItem(INVITE_B, "missed");
    const model = buildPopupInboxModel(accountInbox([active, missed]));

    expect(model?.activeRoomInvites).toEqual([active]);
    expect(model?.missedRoomInvites).toEqual([missed]);
  });

  it("returns no model before an account-owned response is available", () => {
    expect(buildPopupInboxModel(null)).toBeNull();
  });
});

const VIEWER_ID = "00000000-0000-4000-8000-000000000001";
const USER_A = "00000000-0000-4000-8000-000000000002";
const INVITE_A = "00000000-0000-4000-8000-000000000003";
const INVITE_B = "00000000-0000-4000-8000-000000000004";
const FRIENDSHIP_A = "00000000-0000-4000-8000-000000000005";

function friend(
  userId: string,
  friendshipId: string,
  displayName = userId,
  status: FriendListItem["status"] = "pending",
): FriendListItem {
  return {
    friendshipId,
    user: { userId, handle: null, displayName, avatarUrl: null },
    status,
    direction: status === "accepted" ? "mutual" : "incoming",
    requestedAt: NOW,
    respondedAt: status === "accepted" ? NOW : null,
    updatedAt: NOW,
  };
}

function group(
  id: string,
  archivedAt: string | null,
  name = id,
  memberNames: string[] = [],
): FriendGroup {
  return {
    id,
    name,
    archivedAt,
    createdAt: NOW,
    updatedAt: NOW,
    members: memberNames.map((displayName, index) => ({
      user: {
        userId: `${id}-member-${index}`,
        handle: null,
        displayName,
        avatarUrl: null,
      },
      addedAt: NOW,
    })),
  };
}

function recent(userId: string, displayName = userId): RecentPerson {
  return {
    user: { userId, handle: null, displayName, avatarUrl: null },
    lastWatchedAt: NOW,
    sharedRoomCount: 1,
  };
}

function accountInbox(
  items: AccountInboxResponse["items"],
  counts: AccountInboxResponse["counts"] = {
    unseen: items.filter((item) => item.seenAt === null).length,
    actionable: items.filter((item) => item.state !== "missed").length,
    activeRoomInvites: items.filter(
      (item) => item.kind === "room-invite" && item.state === "active",
    ).length,
    pendingFriendRequests: items.filter((item) => item.kind === "friend-request").length,
  },
): AccountInboxResponse {
  return {
    meta: { serverTime: NOW, schemaVersion: 1, ownerUserId: VIEWER_ID },
    items,
    counts,
    nextCursor: null,
  };
}

function roomInviteItem(
  inviteId: string,
  state: "active" | "missed",
): Extract<AccountInboxResponse["items"][number], { kind: "room-invite" }> {
  const item = {
    kind: "room-invite" as const,
    inviteId,
    roomId: `room-${inviteId}`,
    sender: {
      userId: USER_A,
      handle: null,
      displayName: "Host",
      avatarUrl: null,
    },
    targetKind: "direct" as const,
    targetGroupId: null,
    targetGroupName: null,
    message: null,
    roomTitle: "Watch room",
    sourceUrl: "https://www.youtube.com/watch?v=video",
    videoFingerprint: "youtube:video",
    createdAt: NOW,
    activityAt: NOW,
    seenAt: null,
  };
  return state === "active"
    ? { ...item, state: "active", missedAt: null }
    : { ...item, state: "missed", missedAt: NOW };
}

function friendRequestItem(
  friendshipId: string,
  userId: string,
  displayName: string,
): Extract<AccountInboxResponse["items"][number], { kind: "friend-request" }> {
  return {
    kind: "friend-request",
    friendshipId,
    sender: { userId, handle: null, displayName, avatarUrl: null },
    state: "pending",
    createdAt: NOW,
    activityAt: NOW,
    seenAt: null,
  };
}
