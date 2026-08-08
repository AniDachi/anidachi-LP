import { describe, expect, it } from "vitest";
import {
  ACCOUNT_RESPONSE_SCHEMA_VERSION,
  FriendGroupsResponseSchema,
  FriendListResponseSchema,
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
const ROOM_ID = "room-1";
const SESSION_ID = "77777777-7777-4777-8777-777777777777";

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
    expect(() => WatchLibraryResponseSchema.parse(watchLibraryFixture())).not.toThrow();
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
