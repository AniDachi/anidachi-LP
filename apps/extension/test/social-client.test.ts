import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptFriendRequest,
  acceptFriendRequestHttpMessage,
  acceptInviteHttpMessage,
  addGroupMemberHttpMessage,
  archiveGroupHttpMessage,
  createGroupHttpMessage,
  createInviteHttpMessage,
  declineFriendRequest,
  declineFriendRequestHttpMessage,
  declineInviteHttpMessage,
  handleSocialHttpMessage,
  isSocialHttpMessage,
  listSocialDirectory,
  listSocialDirectoryFromApi,
  listSocialDirectoryHttpMessage,
  listInvitesHttpMessage,
  listInviteTargetsFromApi,
  listInviteTargetsHttpMessage,
  listRoomInvitesFromApi,
  removeGroupMemberHttpMessage,
  sendFriendRequest,
  sendFriendRequestHttpMessage,
  updateGroupHttpMessage,
} from "../src/social-client";

const NOW = "2026-08-06T12:00:00.000Z";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const INVITE_ID = "22222222-2222-4222-8222-222222222222";
const FRIENDSHIP_ID = "33333333-3333-4333-8333-333333333333";
const GROUP_ID = "44444444-4444-4444-8444-444444444444";
const ARCHIVED_GROUP_ID = "55555555-5555-4555-8555-555555555555";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function friendListItem(overrides: Record<string, unknown> = {}) {
  return {
    friendshipId: FRIENDSHIP_ID,
    user: {
      userId: USER_ID,
      handle: "ren",
      displayName: "Ren",
      avatarUrl: null,
    },
    status: "pending",
    direction: "outgoing",
    requestedAt: NOW,
    respondedAt: null,
    updatedAt: NOW,
    ...overrides,
  };
}

function friendGroup(id: string, archivedAt: string | null) {
  return {
    id,
    name: "Friday anime",
    archivedAt,
    createdAt: NOW,
    updatedAt: NOW,
    members: [],
  };
}

function socialDirectoryResponses() {
  return [
    {
      meta: { serverTime: NOW, schemaVersion: 1 },
      friends: [friendListItem({ status: "accepted", direction: "mutual" })],
      incomingRequests: [friendListItem({ direction: "incoming" })],
      outgoingRequests: [friendListItem()],
      blocked: [],
    },
    {
      meta: { serverTime: NOW, schemaVersion: 1 },
      groups: [friendGroup(GROUP_ID, null), friendGroup(ARCHIVED_GROUP_ID, NOW)],
    },
    {
      meta: { serverTime: NOW, schemaVersion: 1 },
      people: [
        {
          user: {
            userId: USER_ID,
            handle: "ren",
            displayName: "Ren",
            avatarUrl: null,
          },
          lastWatchedAt: NOW,
          sharedRoomCount: 2,
        },
      ],
    },
  ] as const;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extension social HTTP bridge", () => {
  it("loads the canonical social directory in parallel and excludes archived groups", async () => {
    const fetchMock = vi.fn();
    for (const response of socialDirectoryResponses()) {
      fetchMock.mockResolvedValueOnce(jsonResponse(response));
    }
    vi.stubGlobal("fetch", fetchMock);

    const directoryPromise = listSocialDirectoryFromApi("access-1");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    await expect(directoryPromise).resolves.toMatchObject({
      friends: [{ status: "accepted" }],
      incomingRequests: [{ direction: "incoming" }],
      outgoingRequests: [{ direction: "outgoing" }],
      groups: [{ id: GROUP_ID }],
      recentPeople: [{ sharedRoomCount: 2 }],
    });
    expect(fetchMock.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
      "/api/friends",
      "/api/groups",
      "/api/recent-people",
    ]);
  });

  it.each([
    ["friends", { friends: [], incomingRequests: [], outgoingRequests: [], blocked: [] }],
    ["groups", { groups: [] }],
    ["recent people", { people: [] }],
  ])("returns the safe account error for malformed %s responses", async (_name, malformedBody) => {
    const responses: unknown[] = [...socialDirectoryResponses()];
    const responseIndex = _name === "friends" ? 0 : _name === "groups" ? 1 : 2;
    responses[responseIndex] = malformedBody;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: URL) => jsonResponse(responses.shift())));

    await expect(listSocialDirectoryFromApi("access-1")).rejects.toMatchObject({
      code: "INVALID_ACCOUNT_RESPONSE",
      message: "Account data is temporarily unavailable. Try again.",
    });
  });

  it("uses route-specific response fields and normalizes friend request commands", async () => {
    const sentRequest = friendListItem();
    const acceptedRequest = friendListItem({ status: "accepted", direction: "mutual" });
    const declinedRequest = friendListItem({ status: "declined", direction: "incoming", respondedAt: NOW });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ request: sentRequest }))
      .mockResolvedValueOnce(jsonResponse({ friendship: acceptedRequest }))
      .mockResolvedValueOnce(jsonResponse({ friendship: declinedRequest }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      handleSocialHttpMessage(sendFriendRequestHttpMessage("access-1", USER_ID)),
    ).resolves.toEqual({ ok: true, request: sentRequest });
    await expect(
      handleSocialHttpMessage(acceptFriendRequestHttpMessage("access-1", FRIENDSHIP_ID)),
    ).resolves.toEqual({ ok: true, request: acceptedRequest });
    await expect(
      handleSocialHttpMessage(declineFriendRequestHttpMessage("access-1", FRIENDSHIP_ID)),
    ).resolves.toEqual({ ok: true, request: declinedRequest });

    expect(fetchMock.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
      "/api/friends/requests",
      `/api/friends/requests/${FRIENDSHIP_ID}/accept`,
      `/api/friends/requests/${FRIENDSHIP_ID}/decline`,
    ]);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ userId: USER_ID }),
    });
    expect(fetchMock.mock.calls.slice(1).map(([, init]) => init)).toEqual([
      expect.objectContaining({ method: "POST" }),
      expect.objectContaining({ method: "POST" }),
    ]);
  });

  it("returns the safe account error for malformed friend request mutations", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({})));

    await expect(
      handleSocialHttpMessage(sendFriendRequestHttpMessage("access-1", USER_ID)),
    ).resolves.toMatchObject({
      ok: false,
      code: "INVALID_ACCOUNT_RESPONSE",
      error: expect.stringContaining("Account data is temporarily unavailable"),
    });
  });

  it("uses public social directory and friend request wrappers through the runtime bridge", async () => {
    const [friendsResponse, groupsResponse, recentPeopleResponse] = socialDirectoryResponses();
    const directory = {
      friends: friendsResponse.friends,
      incomingRequests: friendsResponse.incomingRequests,
      outgoingRequests: friendsResponse.outgoingRequests,
      groups: groupsResponse.groups.filter((group) => !group.archivedAt),
      recentPeople: recentPeopleResponse.people,
    };
    const sentRequest = friendListItem();
    const acceptedRequest = friendListItem({ status: "accepted", direction: "mutual" });
    const declinedRequest = friendListItem({ status: "declined", direction: "incoming", respondedAt: NOW });
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, directory })
      .mockResolvedValueOnce({ ok: true, request: sentRequest })
      .mockResolvedValueOnce({ ok: true, request: acceptedRequest })
      .mockResolvedValueOnce({ ok: true, request: declinedRequest });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    await expect(listSocialDirectory("access-1")).resolves.toEqual(directory);
    await expect(sendFriendRequest("access-1", USER_ID)).resolves.toEqual(sentRequest);
    await expect(acceptFriendRequest("access-1", FRIENDSHIP_ID)).resolves.toEqual(acceptedRequest);
    await expect(declineFriendRequest("access-1", FRIENDSHIP_ID)).resolves.toEqual(declinedRequest);
    expect(sendMessage).toHaveBeenNthCalledWith(1, listSocialDirectoryHttpMessage("access-1"));
    expect(sendMessage).toHaveBeenNthCalledWith(
      2,
      sendFriendRequestHttpMessage("access-1", USER_ID),
    );
    expect(sendMessage).toHaveBeenNthCalledWith(
      3,
      acceptFriendRequestHttpMessage("access-1", FRIENDSHIP_ID),
    );
    expect(sendMessage).toHaveBeenNthCalledWith(
      4,
      declineFriendRequestHttpMessage("access-1", FRIENDSHIP_ID),
    );
  });

  it("accepts valid social directory and friend request messages", () => {
    expect(isSocialHttpMessage(listSocialDirectoryHttpMessage("access-1"))).toBe(true);
    expect(isSocialHttpMessage(sendFriendRequestHttpMessage("access-1", USER_ID))).toBe(true);
    expect(isSocialHttpMessage(acceptFriendRequestHttpMessage("access-1", FRIENDSHIP_ID))).toBe(true);
    expect(isSocialHttpMessage(declineFriendRequestHttpMessage("access-1", FRIENDSHIP_ID))).toBe(true);
  });

  it("rejects friend request messages without identifiers", () => {
    expect(
      isSocialHttpMessage({
        type: "ANIDACHI_SOCIAL_HTTP",
        command: "send-friend-request",
        accessToken: "access-1",
        userId: "",
      }),
    ).toBe(false);
    expect(
      isSocialHttpMessage({
        type: "ANIDACHI_SOCIAL_HTTP",
        command: "accept-friend-request",
        accessToken: "access-1",
        requestId: "",
      }),
    ).toBe(false);
  });

  it("rejects a friends response without account metadata", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ friends: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          meta: { serverTime: NOW, schemaVersion: 1 },
          groups: [],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listInviteTargetsFromApi("access-1")).rejects.toMatchObject({
      code: "INVALID_ACCOUNT_RESPONSE",
      message: "Account data is temporarily unavailable. Try again.",
    });
  });

  it("rejects an invalid invite nested inside a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          meta: { serverTime: NOW, schemaVersion: 1 },
          inbox: [{ id: "not-a-uuid" }],
          sent: [],
        }),
      ),
    );

    await expect(listRoomInvitesFromApi("access-1")).rejects.toMatchObject({
      code: "INVALID_ACCOUNT_RESPONSE",
      message: "Account data is temporarily unavailable. Try again.",
    });
  });

  it("accepts invite timestamps returned with an explicit UTC offset", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          meta: { serverTime: NOW, schemaVersion: 1 },
          inbox: [
            {
              id: INVITE_ID,
              roomId: "room-1",
              sender: {
                userId: USER_ID,
                handle: "ren",
                displayName: "Ren",
                avatarUrl: null,
              },
              targetKind: "direct",
              targetGroupId: null,
              message: null,
              roomTitle: null,
              sourceUrl: null,
              videoFingerprint: null,
              createdAt: "2026-08-06T12:00:00.000+00:00",
              expiresAt: "2026-08-06T13:00:00.000+00:00",
              recipients: [
                {
                  user: {
                    userId: USER_ID,
                    handle: "ren",
                    displayName: "Ren",
                    avatarUrl: null,
                  },
                  status: "pending",
                  updatedAt: "2026-08-06T12:00:00.000+00:00",
                  respondedAt: null,
                },
              ],
            },
          ],
          sent: [],
        }),
      ),
    );

    await expect(listRoomInvitesFromApi("access-1")).resolves.toMatchObject({
      inbox: [{ id: INVITE_ID }],
    });
  });

  it("accepts list invite target messages", () => {
    expect(isSocialHttpMessage(listInviteTargetsHttpMessage("access-1"))).toBe(true);
  });

  it("accepts create invite messages with direct recipients", () => {
    expect(
      isSocialHttpMessage(
        createInviteHttpMessage("access-1", {
          roomId: "room-1",
          recipientUserIds: ["user-1"],
        }),
      ),
    ).toBe(true);
  });

  it("accepts create invite messages with a group target", () => {
    expect(
      isSocialHttpMessage(
        createInviteHttpMessage("access-1", {
          roomId: "room-1",
          groupId: "group-1",
        }),
      ),
    ).toBe(true);
  });

  it("accepts durable inbox list and response messages", () => {
    expect(isSocialHttpMessage(listInvitesHttpMessage("access-1"))).toBe(true);
    expect(isSocialHttpMessage(acceptInviteHttpMessage("access-1", "invite-1"))).toBe(true);
    expect(isSocialHttpMessage(declineInviteHttpMessage("access-1", "invite-1"))).toBe(true);
  });

  it("accepts group management messages", () => {
    expect(isSocialHttpMessage(createGroupHttpMessage("access-1", { name: "Friday anime" }))).toBe(
      true,
    );
    expect(
      isSocialHttpMessage(
        updateGroupHttpMessage("access-1", {
          groupId: "group-1",
          name: "Weekend anime",
        }),
      ),
    ).toBe(true);
    expect(isSocialHttpMessage(archiveGroupHttpMessage("access-1", "group-1"))).toBe(true);
    expect(
      isSocialHttpMessage(
        addGroupMemberHttpMessage("access-1", {
          groupId: "group-1",
          userId: "user-1",
        }),
      ),
    ).toBe(true);
    expect(
      isSocialHttpMessage(
        removeGroupMemberHttpMessage("access-1", {
          groupId: "group-1",
          userId: "user-1",
        }),
      ),
    ).toBe(true);
  });

  it("rejects malformed create invite messages", () => {
    expect(
      isSocialHttpMessage({
        type: "ANIDACHI_SOCIAL_HTTP",
        command: "create-invite",
        accessToken: "access-1",
        input: { roomId: "room-1", recipientUserIds: [123] },
      }),
    ).toBe(false);
  });

  it("rejects malformed group management messages", () => {
    expect(
      isSocialHttpMessage({
        type: "ANIDACHI_SOCIAL_HTTP",
        command: "create-group",
        accessToken: "access-1",
        input: { name: "   " },
      }),
    ).toBe(false);
    expect(
      isSocialHttpMessage({
        type: "ANIDACHI_SOCIAL_HTTP",
        command: "update-group",
        accessToken: "access-1",
        input: { groupId: "group-1", name: "" },
      }),
    ).toBe(false);
    expect(
      isSocialHttpMessage({
        type: "ANIDACHI_SOCIAL_HTTP",
        command: "add-group-member",
        accessToken: "access-1",
        input: { groupId: "group-1" },
      }),
    ).toBe(false);
  });

  it("rejects malformed invite response messages", () => {
    expect(
      isSocialHttpMessage({
        type: "ANIDACHI_SOCIAL_HTTP",
        command: "accept-invite",
        accessToken: "access-1",
        inviteId: "",
      }),
    ).toBe(false);
  });
});
