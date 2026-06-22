import { describe, expect, it } from "vitest";
import {
  acceptInviteHttpMessage,
  createInviteHttpMessage,
  declineInviteHttpMessage,
  isSocialHttpMessage,
  listInvitesHttpMessage,
  listInviteTargetsHttpMessage,
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
