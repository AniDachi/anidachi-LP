import { afterEach, describe, expect, it, vi } from "vitest";
import { WEB_HTTP_BASE } from "../src/constants";
import {
  createFriendInviteLink,
  createFriendInviteLinkFromApi,
  handleSocialHttpMessage,
  isSocialHttpMessage,
  removeFriend,
  removeFriendFromApi,
  saveFriendGroup,
  saveFriendGroupFromApi,
  type SaveFriendGroupInput,
} from "../src/social-client";
const OWNER = "11111111-1111-4111-8111-111111111111";
const GROUP = "22222222-2222-4222-8222-222222222222";
const MEMBER = "33333333-3333-4333-8333-333333333333";
const NOW = "2026-09-11T12:00:00.000Z";
const INPUT: SaveFriendGroupInput = {
  groupId: GROUP,
  name: "Friday",
  memberIds: [MEMBER],
  create: true,
  expectedUpdatedAt: null,
};
const saved = {
  id: GROUP,
  name: "Friday",
  members: [],
  archivedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};
const link = {
  url: new URL("/friend/invite/single-use", WEB_HTTP_BASE).toString(),
  expiresAt: NOW,
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const base = {
  type: "ANIDACHI_SOCIAL_HTTP",
  accessToken: "test-token",
  ownerUserId: OWNER,
} as const;
afterEach(() => vi.unstubAllGlobals());

describe("People editor bridge", () => {
  it("sends one atomic group payload and captured owner header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ group: saved }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await saveFriendGroupFromApi("test-token", OWNER, INPUT)).toEqual(
      saved,
    );
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      new URL("/api/groups/editor", WEB_HTTP_BASE).toString(),
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(INPUT);
    expect(new Headers(init.headers).get("x-anidachi-social-owner")).toBe(
      OWNER,
    );
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer test-token",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("preserves the expected revision and server conflict error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response(
          {
            error: "Group changed. Reload before saving.",
            code: "GROUP_CONFLICT",
          },
          409,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const input = { ...INPUT, create: false, expectedUpdatedAt: NOW };
    await expect(
      saveFriendGroupFromApi("test-token", OWNER, input),
    ).rejects.toMatchObject({ code: "GROUP_CONFLICT" });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual(input);
  });
  it.each([
    { ownerUserId: "bad" },
    { accessToken: "" },
    { input: { ...INPUT, groupId: "bad" } },
    { input: { ...INPUT, name: " " } },
    { input: { ...INPUT, name: "x".repeat(81) } },
    { input: { ...INPUT, memberIds: ["bad"] } },
    { input: { ...INPUT, memberIds: Array(101).fill(MEMBER) } },
    { input: { ...INPUT, create: false, expectedUpdatedAt: null } },
    { input: { ...INPUT, create: false, expectedUpdatedAt: "bad" } },
  ])("rejects malformed mutation messages %#", (override) => {
    expect(
      isSocialHttpMessage({
        ...base,
        command: "save-group",
        input: INPUT,
        ...override,
      }),
    ).toBe(false);
  });
  it("accepts the owner-bound commands while keeping old invite commands compatible", () => {
    expect(
      isSocialHttpMessage({ ...base, command: "save-group", input: INPUT }),
    ).toBe(true);
    expect(
      isSocialHttpMessage({ ...base, command: "create-friend-link" }),
    ).toBe(true);
    expect(
      isSocialHttpMessage({
        ...base,
        command: "remove-friend",
        userId: MEMBER,
      }),
    ).toBe(true);
    expect(
      isSocialHttpMessage({
        ...base,
        command: "accept-friend-request",
        requestId: MEMBER,
      }),
    ).toBe(true);
    expect(
      isSocialHttpMessage({ ...base, command: "list-invite-targets" }),
    ).toBe(true);
  });
  it("creates a link with owner header and excludes the extra token field", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response({ inviteLink: { ...link, token: "single-use" } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    expect(await createFriendInviteLinkFromApi("test-token", OWNER)).toEqual(
      link,
    );
    expect(String(fetchMock.mock.calls[0]![0])).toContain(
      "/api/friends/invite-links",
    );
    expect(
      new Headers(fetchMock.mock.calls[0]![1].headers).get(
        "x-anidachi-social-owner",
      ),
    ).toBe(OWNER);
  });
  it.each([
    { ...link, url: "https://other.example/friend/invite/token" },
    { ...link, expiresAt: "invalid" },
    {
      ...link,
      url: new URL("/account?token=secret", WEB_HTTP_BASE).toString(),
    },
    { ...link, url: `${link.url}?token=secret` },
    null,
  ])("rejects malformed or foreign invitation links %#", async (inviteLink) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ inviteLink })));
    await expect(
      createFriendInviteLinkFromApi("test-token", OWNER),
    ).rejects.toMatchObject({ code: "INVALID_ACCOUNT_RESPONSE" });
  });
  it("does not report a different or malformed group as saved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ group: { ...saved, id: MEMBER } })),
    );
    await expect(
      saveFriendGroupFromApi("test-token", OWNER, INPUT),
    ).rejects.toMatchObject({ code: "INVALID_ACCOUNT_RESPONSE" });
  });
  it("removes only the named friend using owner-bound DELETE", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await removeFriendFromApi("test-token", OWNER, MEMBER);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      new URL(`/api/friends/${MEMBER}`, WEB_HTTP_BASE).toString(),
    );
    expect(fetchMock.mock.calls[0]![1].method).toBe("DELETE");
    expect(
      new Headers(fetchMock.mock.calls[0]![1].headers).get(
        "x-anidachi-social-owner",
      ),
    ).toBe(OWNER);
  });
  it("dispatches all new commands through the existing background boundary", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response({ group: saved }))
        .mockResolvedValueOnce(response({ inviteLink: link }))
        .mockResolvedValueOnce(response({ ok: true })),
    );
    expect(
      await handleSocialHttpMessage({
        ...base,
        command: "save-group",
        input: INPUT,
      }),
    ).toEqual({ ok: true, group: saved });
    expect(
      await handleSocialHttpMessage({ ...base, command: "create-friend-link" }),
    ).toEqual({ ok: true, inviteLink: link });
    expect(
      await handleSocialHttpMessage({
        ...base,
        command: "remove-friend",
        userId: MEMBER,
      }),
    ).toEqual({ ok: true, removedUserId: MEMBER });
  });
  it("uses runtime messaging and validates returned identities", async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, group: saved })
      .mockResolvedValueOnce({ ok: true, inviteLink: link })
      .mockResolvedValueOnce({ ok: true, removedUserId: OWNER });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    expect(await saveFriendGroup("test-token", OWNER, INPUT)).toEqual(saved);
    expect(await createFriendInviteLink("test-token", OWNER)).toEqual(link);
    await expect(removeFriend("test-token", OWNER, MEMBER)).rejects.toThrow(
      "removed friend",
    );
    expect(sendMessage.mock.calls[0]![0]).toEqual({
      ...base,
      command: "save-group",
      input: INPUT,
    });
  });
});
