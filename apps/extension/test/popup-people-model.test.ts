import type {
  FriendGroup,
  FriendListItem,
  RecentPerson,
  RoomInvite,
  SocialSnapshot,
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
      incomingRequests: [friend("incoming-a", "incoming-a"), friend("incoming-a", "incoming-a-duplicate")],
      outgoingRequests: [friend("outgoing-a", "outgoing-a"), friend("outgoing-b", "outgoing-b"), friend("outgoing-a", "outgoing-a-duplicate")],
      groups: [group("group-a", null), group("group-a", null, "Group A duplicate"), group("group-b", null)],
      recentPeople: [recent("recent-a"), recent("recent-a", "Recent duplicate"), recent("recent-b")],
    });

    expect(model.friends.map((item) => item.user.userId)).toEqual(["friend-a", "friend-b"]);
    expect([...model.incomingRequestUserIds]).toEqual(["incoming-a"]);
    expect([...model.outgoingRequestUserIds]).toEqual(["outgoing-a", "outgoing-b"]);
    expect(model.groups.map((item) => item.id)).toEqual(["group-a", "group-b"]);
    expect(model.recentPeople.map((item) => item.user.userId)).toEqual(["recent-a", "recent-b"]);
  });

  it("keeps only accepted friends and removes known relationships from recent people", () => {
    const model = buildPopupPeopleModel({
      friends: [friend("friend", "friendship", "Friend", "accepted"), friend("not-accepted", "pending-friendship", "Pending", "pending")],
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

    expect(() => (model.incomingRequestUserIds as unknown as Set<string>).add("injected")).toThrow(TypeError);
    expect(() => (model.outgoingRequestUserIds as unknown as Set<string>).delete("outgoing")).toThrow(TypeError);
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
  it("deduplicates actionable rows by stable ID for both count and consumers", () => {
    const pendingRequest = friend("incoming", "friendship-a");
    const pendingInvite = roomInvite("invite-a", "pending");
    const model = buildPopupInboxModel(
      snapshot({
        incomingRequests: [pendingRequest, { ...pendingRequest }],
        invites: [pendingInvite, { ...pendingInvite }],
      }),
      Date.parse(NOW),
    );
    expect(model).not.toBeNull();

    expect(model!.friendRequests.map((request) => request.friendshipId)).toEqual(["friendship-a"]);
    expect(model!.roomInvites.map((invite) => invite.id)).toEqual(["invite-a"]);
    expect(model!.actionableCount).toBe(2);
  });

  it("excludes completed and expired rows without changing stable server order", () => {
    const model = buildPopupInboxModel(
      snapshot({
        incomingRequests: [
          friend("first", "friendship-first"),
          friend("accepted", "friendship-accepted", "accepted", "accepted"),
          friend("last", "friendship-last"),
        ],
        invites: [
          roomInvite("invite-first", "pending"),
          { ...roomInvite("invite-expired", "pending"), expiresAt: "2026-08-07T12:00:00.000Z" },
          roomInvite("invite-declined", "declined"),
          roomInvite("invite-last", "pending"),
        ],
      }),
      Date.parse(NOW),
    );
    expect(model).not.toBeNull();

    expect(model!.friendRequests.map((request) => request.friendshipId)).toEqual([
      "friendship-first",
      "friendship-last",
    ]);
    expect(model!.roomInvites.map((invite) => invite.id)).toEqual(["invite-first", "invite-last"]);
  });
});

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

function group(id: string, archivedAt: string | null, name = id, memberNames: string[] = []): FriendGroup {
  return {
    id,
    name,
    archivedAt,
    createdAt: NOW,
    updatedAt: NOW,
    members: memberNames.map((displayName, index) => ({
      user: { userId: `${id}-member-${index}`, handle: null, displayName, avatarUrl: null },
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

function snapshot({
  incomingRequests = [],
  invites = [],
}: {
  incomingRequests?: FriendListItem[];
  invites?: RoomInvite[];
}): SocialSnapshot {
  return {
    directory: {
      friends: [],
      incomingRequests,
      outgoingRequests: [],
      groups: [],
      recentPeople: [],
    },
    invites: {
      meta: { serverTime: NOW, schemaVersion: 1 },
      inbox: invites,
      sent: [],
    },
  };
}

function roomInvite(id: string, status: "pending" | "accepted" | "declined"): RoomInvite {
  return {
    id,
    roomId: `room-${id}`,
    sender: { userId: "host", handle: null, displayName: "Host", avatarUrl: null },
    targetKind: "direct",
    targetGroupId: null,
    message: null,
    roomTitle: "Watch room",
    sourceUrl: "https://www.youtube.com/watch?v=video",
    videoFingerprint: "youtube:video",
    createdAt: NOW,
    expiresAt: "2099-08-08T12:00:00.000Z",
    recipients: [
      {
        user: { userId: "viewer", handle: null, displayName: "Viewer", avatarUrl: null },
        status,
        updatedAt: NOW,
        respondedAt: status === "pending" ? null : NOW,
      },
    ],
  };
}
