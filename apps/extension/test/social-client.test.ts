import { describe, expect, it } from "vitest";
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
  removeGroupMemberHttpMessage,
  updateGroupHttpMessage,
} from "../src/social-client";

describe("extension social HTTP bridge", () => {
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
