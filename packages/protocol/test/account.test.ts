import { describe, expect, it } from "vitest";
import {
  ACCOUNT_RESPONSE_SCHEMA_VERSION,
  AccountInboxResponseSchema,
  CreateRoomInviteRequestSchema,
  DevicePushSubscriptionResponseSchema,
  ExtensionPushSubscriptionRequestSchema,
  FriendGroupsResponseSchema,
  FriendListResponseSchema,
  InboxChangedPushPayloadSchema,
  RecentPeopleResponseSchema,
  RecentPersonSchema,
  RoomInvitesResponseSchema,
  SocialDirectorySchema,
  SocialSnapshotSchema,
  WatchLibraryResponseSchema,
} from "../src";

const NOW = "2026-08-06T12:00:00.000Z";
const NOW_WITH_OFFSET = "2026-08-06T12:00:00.000+00:00";
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const FRIENDSHIP_ID = "33333333-3333-4333-8333-333333333333";
const GROUP_ID = "44444444-4444-4444-8444-444444444444";
const INVITE_ID = "55555555-5555-4555-8555-555555555555";
const CLIENT_ACTION_ID = "66666666-6666-4666-8666-666666666666";
const ROOM_ID = "room-1";
const SESSION_ID = "77777777-7777-4777-8777-777777777777";
const MISSED_INVITE_ID = "88888888-8888-4888-8888-888888888888";

const meta = { serverTime: NOW, schemaVersion: 1 as const };
const userB = {
  userId: USER_B,
  handle: "ren",
  displayName: "Ren",
  avatarUrl: null,
};
const friend = {
  friendshipId: FRIENDSHIP_ID,
  user: userB,
  status: "accepted" as const,
  direction: "mutual" as const,
  requestedAt: NOW,
  respondedAt: NOW,
  updatedAt: NOW,
};
const group = {
  id: GROUP_ID,
  name: "Friday anime",
  archivedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  members: [{ user: userB, addedAt: NOW }],
};
const recentPerson = {
  user: userB,
  lastWatchedAt: NOW,
  sharedRoomCount: 3,
};
const invite = {
  id: INVITE_ID,
  roomId: ROOM_ID,
  sender: userB,
  targetKind: "direct" as const,
  targetGroupId: null,
  message: null,
  roomTitle: "One-Punch Man",
  sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
  videoFingerprint: "youtube:abcdefghijk",
  createdAt: NOW,
  expiresAt: "2026-08-06T13:00:00.000Z",
  recipients: [
    {
      user: userB,
      status: "pending" as const,
      updatedAt: NOW,
      respondedAt: null,
    },
  ],
};

function watchLibraryFixture() {
  return {
    meta,
    generatedAt: NOW,
    limits: {
      planCode: "plus" as const,
      maxActiveTrackedTitles: 100,
      activeTrackedTitleCount: 1,
      historyRetentionDays: 90,
      retainedSince: "2026-05-08T12:00:00.000Z",
    },
    items: [
      {
        provider: "youtube" as const,
        itemKey: "abcdefghijk",
        itemKind: "movie" as const,
        itemTitle: "Demo",
        sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        artworkUrl: null,
        active: true,
        lastWatchedAt: NOW,
        episodes: [
          {
            episodeKey: "abcdefghijk",
            episodeTitle: "Demo",
            seasonId: null,
            seasonTitle: null,
            seasonNumber: null,
            sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
            currentTime: 60,
            duration: 600,
            progress: 0.1,
            lastWatchedAt: NOW,
            sessions: [
              {
                id: SESSION_ID,
                roomId: ROOM_ID,
                hostUserId: USER_A,
                kind: "shared" as const,
                currentTime: 60,
                duration: 600,
                progress: 0.1,
                startedAt: NOW,
                endedAt: null,
                lastWatchedAt: NOW,
                participants: [
                  {
                    user: userB,
                    role: "viewer" as const,
                    currentTime: 60,
                    progress: 0.1,
                    joinedAt: NOW,
                    leftAt: null,
                    updatedAt: NOW,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("account response contracts", () => {
  it("accepts a recent person with public profile and positive shared room count", () => {
    expect(RecentPersonSchema.parse(recentPerson)).toEqual(recentPerson);
    expect(() =>
      RecentPersonSchema.parse({ ...recentPerson, sharedRoomCount: 0 }),
    ).toThrow();
  });

  it("requires versioned account metadata for recent people responses", () => {
    expect(() =>
      RecentPeopleResponseSchema.parse({ people: [recentPerson] }),
    ).toThrow();
    expect(
      RecentPeopleResponseSchema.parse({ meta, people: [recentPerson] }),
    ).toEqual({ meta, people: [recentPerson] });
  });

  it("accepts an owner-bound account inbox with active, missed, and friend-request items", () => {
    const response = {
      meta: { ...meta, ownerUserId: USER_A },
      items: [
        {
          kind: "room-invite" as const,
          inviteId: INVITE_ID,
          roomId: ROOM_ID,
          sender: userB,
          targetKind: "direct" as const,
          targetGroupId: null,
          targetGroupName: null,
          message: null,
          roomTitle: "One-Punch Man",
          sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
          videoFingerprint: "youtube:abcdefghijk",
          state: "active" as const,
          createdAt: NOW,
          activityAt: NOW,
          seenAt: null,
          missedAt: null,
        },
        {
          kind: "room-invite" as const,
          inviteId: MISSED_INVITE_ID,
          roomId: "room-ended",
          sender: userB,
          targetKind: "group" as const,
          targetGroupId: GROUP_ID,
          targetGroupName: "Friday anime",
          message: "Join us",
          roomTitle: null,
          sourceUrl: null,
          videoFingerprint: null,
          state: "missed" as const,
          createdAt: "2026-08-06T10:00:00.000Z",
          activityAt: "2026-08-06T11:00:00.000Z",
          seenAt: NOW,
          missedAt: "2026-08-06T11:00:00.000Z",
        },
        {
          kind: "friend-request" as const,
          friendshipId: FRIENDSHIP_ID,
          sender: userB,
          state: "pending" as const,
          createdAt: NOW,
          activityAt: NOW,
          seenAt: null,
        },
      ],
      counts: {
        unseen: 2,
        actionable: 2,
        activeRoomInvites: 1,
        pendingFriendRequests: 1,
      },
      nextCursor: null,
    };

    expect(AccountInboxResponseSchema.parse(response)).toEqual(response);
  });

  it("accepts the minimal extension push registration contract", () => {
    const request = {
      installationId: "99999999-9999-4999-8999-999999999999",
      endpoint: "https://push.example.test/subscriptions/device-1",
      expirationTime: null,
      keys: {
        p256dh:
          "BEl62iUYgUivxIkv69yViEuiBIa40HIhZbGzOCh6vTZMeYKv4A6eQHHuQNaO8h-SS5kxtR7U7I3F4R5y6T7u8V9",
        auth: "BTBZMqHH6r4Tts7J_aSIgg",
      },
    };

    expect(ExtensionPushSubscriptionRequestSchema.parse(request)).toEqual(request);
    expect(
      DevicePushSubscriptionResponseSchema.parse({
        deviceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        notificationsEnabled: true,
        updatedAt: NOW,
      }),
    ).toEqual({
      deviceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      notificationsEnabled: true,
      updatedAt: NOW,
    });
    expect(InboxChangedPushPayloadSchema.parse({ type: "inbox_changed" })).toEqual({
      type: "inbox_changed",
    });
  });

  it("rejects unsafe or incomplete extension push registrations", () => {
    const valid = {
      installationId: "99999999-9999-4999-8999-999999999999",
      endpoint: "https://push.example.test/subscriptions/device-1",
      expirationTime: null,
      keys: {
        p256dh:
          "BEl62iUYgUivxIkv69yViEuiBIa40HIhZbGzOCh6vTZMeYKv4A6eQHHuQNaO8h-SS5kxtR7U7I3F4R5y6T7u8V9",
        auth: "BTBZMqHH6r4Tts7J_aSIgg",
      },
    };

    expect(() =>
      ExtensionPushSubscriptionRequestSchema.parse({
        ...valid,
        endpoint: "http://push.example.test/subscriptions/device-1",
      }),
    ).toThrow();
    expect(() =>
      ExtensionPushSubscriptionRequestSchema.parse({
        ...valid,
        keys: { ...valid.keys, auth: "not base64!" },
      }),
    ).toThrow();
    expect(() =>
      InboxChangedPushPayloadSchema.parse({
        type: "inbox_changed",
        inviteId: INVITE_ID,
      }),
    ).toThrow();
  });

  it("rejects account inboxes without an owner or with inconsistent room lifecycle fields", () => {
    const activeInvite = {
      kind: "room-invite" as const,
      inviteId: INVITE_ID,
      roomId: ROOM_ID,
      sender: userB,
      targetKind: "direct" as const,
      targetGroupId: null,
      targetGroupName: null,
      message: null,
      roomTitle: null,
      sourceUrl: null,
      videoFingerprint: null,
      state: "active" as const,
      createdAt: NOW,
      activityAt: NOW,
      seenAt: null,
      missedAt: null,
    };
    const counts = {
      unseen: 1,
      actionable: 1,
      activeRoomInvites: 1,
      pendingFriendRequests: 0,
    };

    expect(() =>
      AccountInboxResponseSchema.parse({
        meta,
        items: [activeInvite],
        counts,
        nextCursor: null,
      }),
    ).toThrow();
    expect(() =>
      AccountInboxResponseSchema.parse({
        meta: { ...meta, ownerUserId: USER_A },
        items: [{ ...activeInvite, missedAt: NOW }],
        counts,
        nextCursor: null,
      }),
    ).toThrow();
  });

  it("contains each social directory section exactly once", () => {
    const directory = {
      friends: [friend],
      incomingRequests: [],
      outgoingRequests: [],
      groups: [group],
      recentPeople: [recentPerson],
    };

    expect(SocialDirectorySchema.parse(directory)).toEqual(directory);
    expect(() =>
      SocialDirectorySchema.parse({ ...directory, blocked: [] }),
    ).toThrow();
  });

  it("accepts directory social snapshots and rejects legacy targets snapshots", () => {
    const friends = FriendListResponseSchema.parse({
      meta,
      friends: [friend],
      incomingRequests: [],
      outgoingRequests: [],
      blocked: [],
    });
    const groups = FriendGroupsResponseSchema.parse({ meta, groups: [group] });
    const invites = RoomInvitesResponseSchema.parse({
      meta,
      inbox: [invite],
      sent: [],
    });

    expect(
      SocialSnapshotSchema.parse({
        directory: {
          friends: friends.friends,
          incomingRequests: [],
          outgoingRequests: [],
          groups: groups.groups,
          recentPeople: [recentPerson],
        },
        invites,
      }),
    ).toEqual({
      directory: {
        friends: [friend],
        incomingRequests: [],
        outgoingRequests: [],
        groups: [group],
        recentPeople: [recentPerson],
      },
      invites,
    });
    expect(() =>
      SocialSnapshotSchema.parse({
        targets: { friends: friends.friends, groups: groups.groups },
        invites,
      }),
    ).toThrow();
    expect(ACCOUNT_RESPONSE_SCHEMA_VERSION).toBe(1);
  });

  it("parses a versioned watch library response", () => {
    expect(() =>
      WatchLibraryResponseSchema.parse(watchLibraryFixture()),
    ).not.toThrow();
  });

  it("accepts one bounded room invite target and an optional idempotency key", () => {
    expect(
      CreateRoomInviteRequestSchema.parse({
        roomId: ROOM_ID,
        clientActionId: CLIENT_ACTION_ID,
        recipientUserIds: [USER_B],
      }),
    ).toEqual({
      roomId: ROOM_ID,
      clientActionId: CLIENT_ACTION_ID,
      recipientUserIds: [USER_B],
    });
    expect(
      CreateRoomInviteRequestSchema.parse({
        roomId: ROOM_ID,
        groupId: GROUP_ID,
        message: "Watch together",
      }),
    ).toEqual({
      roomId: ROOM_ID,
      groupId: GROUP_ID,
      message: "Watch together",
    });
  });

  it("rejects ambiguous, empty, oversized, and malformed room invite requests", () => {
    expect(() =>
      CreateRoomInviteRequestSchema.parse({
        roomId: ROOM_ID,
        recipientUserIds: [USER_B],
        groupId: GROUP_ID,
      }),
    ).toThrow();
    expect(() =>
      CreateRoomInviteRequestSchema.parse({ roomId: ROOM_ID }),
    ).toThrow();
    expect(() =>
      CreateRoomInviteRequestSchema.parse({
        roomId: ROOM_ID,
        recipientUserIds: Array.from({ length: 101 }, () => USER_B),
      }),
    ).toThrow();
    expect(() =>
      CreateRoomInviteRequestSchema.parse({
        roomId: ROOM_ID,
        clientActionId: "not-a-uuid",
        recipientUserIds: [USER_B],
      }),
    ).toThrow();
  });

  it("accepts RFC3339 timestamps with an explicit UTC offset", () => {
    expect(() =>
      RoomInvitesResponseSchema.parse({
        meta: { ...meta, serverTime: NOW_WITH_OFFSET },
        inbox: [
          {
            ...invite,
            createdAt: NOW_WITH_OFFSET,
            expiresAt: "2026-08-06T13:00:00.000+00:00",
            recipients: [
              {
                ...invite.recipients[0],
                updatedAt: NOW_WITH_OFFSET,
                respondedAt: NOW_WITH_OFFSET,
              },
            ],
          },
        ],
        sent: [],
      }),
    ).not.toThrow();
  });

  it("rejects timestamps without an explicit timezone", () => {
    expect(() =>
      FriendGroupsResponseSchema.parse({
        meta: { serverTime: "2026-08-06T12:00:00.000", schemaVersion: 1 },
        groups: [],
      }),
    ).toThrow();
  });

  it.each([
    { serverTime: NOW, schemaVersion: 2 },
    { serverTime: "not-a-date", schemaVersion: 1 },
  ])("rejects incompatible account metadata %#", (invalidMeta) => {
    expect(() =>
      FriendGroupsResponseSchema.parse({ meta: invalidMeta, groups: [] }),
    ).toThrow();
  });

  it("rejects unsafe nested records instead of dropping them", () => {
    expect(() =>
      RoomInvitesResponseSchema.parse({
        meta,
        inbox: [{ ...invite, sourceUrl: "javascript:alert(1)" }],
        sent: [],
      }),
    ).toThrow();
    expect(() =>
      FriendListResponseSchema.parse({
        meta,
        friends: [{ ...friend, user: { ...userB, userId: "user-b" } }],
        incomingRequests: [],
        outgoingRequests: [],
        blocked: [],
      }),
    ).toThrow();
  });

  it("rejects invalid playback progress and unsupported providers", () => {
    const fixture = watchLibraryFixture();
    fixture.items[0]!.episodes[0]!.progress = 1.2;
    expect(() => WatchLibraryResponseSchema.parse(fixture)).toThrow();

    const unsupported = watchLibraryFixture();
    Object.assign(unsupported.items[0]!, { provider: "generic" });
    expect(() => WatchLibraryResponseSchema.parse(unsupported)).toThrow();
  });
});
