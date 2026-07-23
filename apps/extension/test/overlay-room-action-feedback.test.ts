import { describe, expect, it } from "vitest";
import {
  copyRoomInviteText,
  getPrimaryRoomActionKind,
  getPrimaryRoomActionLabel,
  isInviteCopiedFeedback,
  shouldConfirmRoomEnd,
} from "../src/overlay-room-action-feedback";

describe("overlay room action feedback", () => {
  it("prioritizes the room creation progress label", () => {
    expect(
      getPrimaryRoomActionLabel({
        feedback: "room-closed",
        roomCreatePending: true,
        roomEndPending: false,
        roomExists: false,
      }),
    ).toBe("Creating room");
  });

  it("shows room creation success before returning to the active-room label", () => {
    expect(
      getPrimaryRoomActionLabel({
        feedback: "room-created",
        roomCreatePending: false,
        roomEndPending: false,
        roomExists: true,
      }),
    ).toBe("Room created");
  });

  it("shows closing progress and then room closed success", () => {
    expect(
      getPrimaryRoomActionLabel({
        feedback: null,
        roomCreatePending: false,
        roomEndPending: true,
        roomExists: true,
      }),
    ).toBe("Closing room");
    expect(
      getPrimaryRoomActionLabel({
        feedback: "room-closed",
        roomCreatePending: false,
        roomEndPending: false,
        roomExists: false,
      }),
    ).toBe("Room closed");
  });

  it("uses the normal labels without active feedback", () => {
    expect(
      getPrimaryRoomActionLabel({
        feedback: null,
        roomCreatePending: false,
        roomEndPending: false,
        roomExists: false,
      }),
    ).toBe("Create room");
    expect(
      getPrimaryRoomActionLabel({
        feedback: null,
        roomCreatePending: false,
        roomEndPending: false,
        roomExists: true,
      }),
    ).toBe("End room");
  });

  it("uses leave as the primary action only for a guest in an active room", () => {
    expect(getPrimaryRoomActionKind({ isHost: false, roomExists: true })).toBe("leave");
    expect(getPrimaryRoomActionKind({ isHost: true, roomExists: true })).toBe("end");
    expect(getPrimaryRoomActionKind({ isHost: false, roomExists: false })).toBe("create");
    expect(
      getPrimaryRoomActionLabel({
        feedback: null,
        isHost: false,
        roomCreatePending: false,
        roomEndPending: false,
        roomExists: true,
        roomLeavePending: false,
      }),
    ).toBe("Leave room");
  });

  it("reports guest leave progress and success", () => {
    expect(
      getPrimaryRoomActionLabel({
        feedback: null,
        isHost: false,
        roomCreatePending: false,
        roomEndPending: false,
        roomExists: true,
        roomLeavePending: true,
      }),
    ).toBe("Leaving room");
    expect(
      getPrimaryRoomActionLabel({
        feedback: "room-left",
        isHost: false,
        roomCreatePending: false,
        roomEndPending: false,
        roomExists: false,
        roomLeavePending: false,
      }),
    ).toBe("Room left");
  });

  it("requests confirmation only when ending a room with guests", () => {
    expect(shouldConfirmRoomEnd(1)).toBe(false);
    expect(shouldConfirmRoomEnd(2)).toBe(true);
    expect(shouldConfirmRoomEnd(6)).toBe(true);
    expect(
      getPrimaryRoomActionLabel({
        feedback: null,
        isHost: true,
        roomCreatePending: false,
        roomEndConfirmationPending: true,
        roomEndPending: false,
        roomExists: true,
        roomLeavePending: false,
      }),
    ).toBe("Confirm end");
  });

  it("identifies only copied-invite feedback for the copy control", () => {
    expect(isInviteCopiedFeedback("invite-copied")).toBe(true);
    expect(isInviteCopiedFeedback("room-created")).toBe(false);
    expect(isInviteCopiedFeedback(null)).toBe(false);
  });

  it("reports clipboard success without using the fallback", async () => {
    let fallbackUsed = false;

    await expect(
      copyRoomInviteText(
        "https://example.com/room",
        async () => undefined,
        () => {
          fallbackUsed = true;
          return true;
        },
      ),
    ).resolves.toBe(true);
    expect(fallbackUsed).toBe(false);
  });

  it("reports the actual fallback result when clipboard access fails", async () => {
    const writeText = async () => {
      throw new Error("clipboard unavailable");
    };

    await expect(copyRoomInviteText("invite", writeText, () => true)).resolves.toBe(true);
    await expect(copyRoomInviteText("invite", writeText, () => false)).resolves.toBe(false);
  });

  it("reports failure when both clipboard strategies throw", async () => {
    await expect(
      copyRoomInviteText(
        "invite",
        async () => {
          throw new Error("clipboard unavailable");
        },
        () => {
          throw new Error("fallback unavailable");
        },
      ),
    ).resolves.toBe(false);
  });
});
