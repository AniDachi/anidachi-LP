import { describe, expect, it } from "vitest";
import {
  ROOM_ADMISSION_JOIN_DEADLINE_MS,
  ROOM_ADMISSION_PENDING_PER_SUBJECT_LIMIT,
  RoomAdmission,
  type RoomAdmissionSocket,
} from "../src/room-admission";

function pendingSocket(
  id: string,
  subject: string,
  deadlineAt: number,
): RoomAdmissionSocket {
  return { deadlineAt, joined: false, socketId: id, subject };
}

describe("RoomAdmission", () => {
  it("rejects a third pending socket for one authenticated subject before it can be retained", () => {
    const admission = new RoomAdmission({ maxParticipants: 4 });

    expect(admission.reserve("member-1", "socket-1", 1_000).allowed).toBe(true);
    expect(admission.reserve("member-1", "socket-2", 1_000).allowed).toBe(true);
    expect(admission.reserve("member-1", "socket-3", 1_000)).toMatchObject({
      allowed: false,
      reason: "subject_pending_limit",
    });
    expect(admission.pendingCount).toBe(2);
  });

  it("derives the pending-room allowance from twice the signed participant limit", () => {
    const admission = new RoomAdmission({ maxParticipants: 3 });

    for (let index = 0; index < 6; index += 1) {
      expect(admission.reserve(`member-${index}`, `socket-${index}`, 1_000).allowed).toBe(true);
    }

    expect(admission.reserve("member-6", "socket-6", 1_000)).toMatchObject({
      allowed: false,
      reason: "room_pending_limit",
    });
  });

  it("updates the pending-room allowance when authenticated room capabilities replace the default", () => {
    const admission = new RoomAdmission({ maxParticipants: 4 });
    admission.setMaxParticipants(6);

    for (let index = 0; index < 12; index += 1) {
      expect(admission.reserve(`member-${index}`, `socket-${index}`, 1_000).allowed).toBe(true);
    }
    expect(admission.reserve("member-12", "socket-12", 1_000)).toMatchObject({
      allowed: false,
      reason: "room_pending_limit",
    });
  });

  it("allows JOIN strictly before the absolute deadline and rejects it at that deadline", () => {
    const admission = new RoomAdmission({ maxParticipants: 2 });
    const reserved = admission.reserve("member-1", "socket-1", 5_000);
    if (!reserved.allowed) throw new Error("expected admission reservation");

    expect(admission.join("socket-1", reserved.deadlineAt - 1)).toEqual({ allowed: true });

    const atBoundary = admission.reserve("member-2", "socket-2", 5_000);
    if (!atBoundary.allowed) throw new Error("expected boundary reservation");
    expect(admission.join("socket-2", atBoundary.deadlineAt)).toEqual({
      allowed: false,
      reason: "join_deadline_elapsed",
    });
  });

  it("releases a pending reservation exactly once across close and error races", () => {
    const admission = new RoomAdmission({ maxParticipants: 2 });
    expect(admission.reserve("member-1", "socket-1", 1_000).allowed).toBe(true);

    expect(admission.release("socket-1")).toBe(true);
    expect(admission.release("socket-1")).toBe(false);
    expect(admission.pendingCount).toBe(0);
  });

  it("rehydrates pending reservations from socket attachments without treating joined sockets as pending", () => {
    const admission = RoomAdmission.rehydrate({
      maxParticipants: 3,
      sockets: [
        pendingSocket("socket-1", "member-1", 11_000),
        { deadlineAt: 11_000, joined: true, socketId: "socket-2", subject: "member-2" },
      ],
    });

    expect(admission.pendingCount).toBe(1);
    expect(admission.reserve("member-1", "socket-3", 1_000).allowed).toBe(true);
    expect(admission.reserve("member-1", "socket-4", 1_000)).toMatchObject({
      allowed: false,
      reason: "subject_pending_limit",
    });
  });

  it("uses the reviewed ten-second deadline and two-pending-socket product boundary", () => {
    expect(ROOM_ADMISSION_PENDING_PER_SUBJECT_LIMIT).toBe(2);
    expect(ROOM_ADMISSION_JOIN_DEADLINE_MS).toBe(10_000);
  });
});
