import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptInviteHttpMessage,
  addGroupMemberHttpMessage,
  archiveGroupHttpMessage,
  createGroupHttpMessage,
  createInviteHttpMessage,
  declineInviteHttpMessage,
  isSocialHttpMessage,
  listInvitesHttpMessage,
  listInviteTargetsHttpMessage,
  listInviteTargetsFromApi,
  listRoomInvitesFromApi,
  removeGroupMemberHttpMessage,
  updateGroupHttpMessage,
} from "../src/social-client";

const NOW = "2026-08-06T12:00:00.000Z";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extension social HTTP bridge", () => {
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

    await expect(listInviteTargetsFromApi("access-1")).rejects.toThrow();
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

    await expect(listRoomInvitesFromApi("access-1")).rejects.toThrow();
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
