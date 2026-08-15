import { jwtVerify, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import {
  MAX_DISPLAY_NAME_CHARS,
  MAX_PARTICIPANT_ID_CHARS,
  MAX_ROOM_ID_CHARS,
  MAX_URL_CHARS,
} from "@anidachi/protocol";
import {
  signRoomHistoryAttestation,
  signRoomTokenForTest,
  verifyRoomToken,
} from "../src/auth";

const env = {
  ANIDACHI_JWT_SECRET: "test-secret-test-secret-test-secret",
};

function testSecret(): Uint8Array {
  return new TextEncoder().encode(env.ANIDACHI_JWT_SECRET);
}

async function signLegacyRoomTokenForTest(): Promise<string> {
  return new SignJWT({
    roomId: "room-1",
    role: "host",
    typ: "room",
    capabilities: {
      hostPlanCode: "junkie",
      maxParticipants: 15,
      maxMediaSeats: 4,
      canNameRoom: true,
      canSendPushInvites: true,
    },
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("user-1")
    .setAudience("anidachi-worker")
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(testSecret());
}

describe("worker room auth", () => {
  it("verifies room token claims for the matching room", async () => {
    const token = await signRoomTokenForTest(
      {
        sub: "user-1",
        roomId: "room-1",
        role: "host",
        displayName: "Alina",
        avatarUrl: "https://example.com/avatar.png",
      },
      env,
    );

    await expect(verifyRoomToken(token, "room-1", env)).resolves.toEqual({
      sub: "user-1",
      roomId: "room-1",
      role: "host",
      displayName: "Alina",
      avatarUrl: "https://example.com/avatar.png",
    });
  });

  it("verifies signed room capabilities", async () => {
    const token = await signRoomTokenForTest(
      {
        sub: "user-1",
        roomId: "room-1",
        role: "host",
        capabilities: {
          hostPlanCode: "pro",
          maxParticipants: 15,
          maxMediaSeats: 4,
          canNameRoom: true,
          canSendPushInvites: true,
        },
      },
      env,
    );

    await expect(verifyRoomToken(token, "room-1", env)).resolves.toMatchObject({
      capabilities: {
        hostPlanCode: "pro",
        maxParticipants: 15,
        maxMediaSeats: 4,
      },
    });
  });

  it("normalizes legacy signed room capabilities", async () => {
    const token = await signLegacyRoomTokenForTest();

    await expect(verifyRoomToken(token, "room-1", env)).resolves.toMatchObject({
      capabilities: {
        hostPlanCode: "pro",
        maxParticipants: 15,
        maxMediaSeats: 4,
      },
    });
  });

  it("rejects room tokens for other rooms", async () => {
    const token = await signRoomTokenForTest(
      {
        sub: "user-1",
        roomId: "room-1",
        role: "host",
      },
      env,
    );

    await expect(verifyRoomToken(token, "room-2", env)).resolves.toBeNull();
  });

  it("rejects malformed tokens", async () => {
    await expect(verifyRoomToken("not-a-token", "room-1", env)).resolves.toBeNull();
  });

  it("rejects bounded room token claims before they reach room state", async () => {
    const oversizedRoomId = "r".repeat(MAX_ROOM_ID_CHARS + 1);
    const oversizedRoomToken = await signRoomTokenForTest(
      { sub: "user-1", roomId: oversizedRoomId, role: "member" },
      env,
    );
    const oversizedParticipantToken = await signRoomTokenForTest(
      { sub: "u".repeat(MAX_PARTICIPANT_ID_CHARS + 1), roomId: "room-1", role: "member" },
      env,
    );

    await expect(verifyRoomToken(oversizedRoomToken, oversizedRoomId, env)).resolves.toBeNull();
    await expect(verifyRoomToken(oversizedParticipantToken, "room-1", env)).resolves.toBeNull();
  });

  it("rejects oversized token display names and avatar URLs", async () => {
    const oversizedDisplayName = await signRoomTokenForTest(
      {
        sub: "user-1",
        roomId: "room-1",
        role: "member",
        displayName: "D".repeat(MAX_DISPLAY_NAME_CHARS + 1),
      },
      env,
    );
    const oversizedAvatarUrl = await signRoomTokenForTest(
      {
        sub: "user-1",
        roomId: "room-1",
        role: "member",
        avatarUrl: `https://example.com/${"x".repeat(MAX_URL_CHARS)}`,
      },
      env,
    );

    await expect(verifyRoomToken(oversizedDisplayName, "room-1", env)).resolves.toBeNull();
    await expect(verifyRoomToken(oversizedAvatarUrl, "room-1", env)).resolves.toBeNull();
  });

  it("rejects otherwise valid room tokens signed with non-HS256 algorithms", async () => {
    const token = await new SignJWT({ roomId: "room-1", role: "member", typ: "room" })
      .setProtectedHeader({ alg: "HS384" })
      .setSubject("user-1")
      .setAudience("anidachi-worker")
      .setIssuedAt()
      .setExpirationTime("30m")
      .sign(testSecret());

    await expect(verifyRoomToken(token, "room-1", env)).resolves.toBeNull();
  });

  it("signs one purpose-bound room history authority without an arbitrary expiry", async () => {
    const beforeIssuedAt = Math.floor(Date.now() / 1_000);
    const token = await signRoomHistoryAttestation(
      {
        sub: "user-1",
        roomId: "room-1",
        participantSessionId: "participant-session-1",
        roomGeneration: 2,
        sourceGeneration: 3,
      },
      env,
    );
    const afterIssuedAt = Math.floor(Date.now() / 1_000);

    const { payload, protectedHeader } = await jwtVerify(token, testSecret(), {
      algorithms: ["HS256"],
      issuer: "anidachi-worker",
      audience: "anidachi-web-history",
    });

    expect(protectedHeader).toEqual({ alg: "HS256" });
    expect(Object.keys(payload).sort()).toEqual([
      "aud",
      "iat",
      "iss",
      "participantSessionId",
      "roomGeneration",
      "roomId",
      "sourceGeneration",
      "sub",
      "typ",
    ]);
    expect(payload).toMatchObject({
      aud: "anidachi-web-history",
      iss: "anidachi-worker",
      participantSessionId: "participant-session-1",
      roomGeneration: 2,
      roomId: "room-1",
      sourceGeneration: 3,
      sub: "user-1",
      typ: "room_history",
    });
    expect(payload.exp).toBeUndefined();
    expect(payload.iat).toBeGreaterThanOrEqual(beforeIssuedAt);
    expect(payload.iat).toBeLessThanOrEqual(afterIssuedAt);
  });

  it("keeps room connection tokens and history attestations mutually isolated", async () => {
    const historyAttestation = await signRoomHistoryAttestation(
      {
        sub: "user-1",
        roomId: "room-1",
        participantSessionId: "participant-session-1",
        roomGeneration: 1,
        sourceGeneration: 1,
      },
      env,
    );
    const roomToken = await signRoomTokenForTest(
      { sub: "user-1", roomId: "room-1", role: "host" },
      env,
    );

    await expect(verifyRoomToken(historyAttestation, "room-1", env)).resolves.toBeNull();
    await expect(
      jwtVerify(roomToken, testSecret(), {
        algorithms: ["HS256"],
        issuer: "anidachi-worker",
        audience: "anidachi-web-history",
      }),
    ).rejects.toThrow();
  });

  it("rejects unbounded or incomplete room history claims before signing", async () => {
    await expect(
      signRoomHistoryAttestation(
        {
          sub: "user-1",
          roomId: "room-1",
          participantSessionId: "",
          roomGeneration: 1,
          sourceGeneration: 1,
        },
        env,
      ),
    ).rejects.toThrow("Invalid room history authority claims");
    await expect(
      signRoomHistoryAttestation(
        {
          sub: "user-1",
          roomId: "room-1",
          participantSessionId: "participant-session-1",
          roomGeneration: 0,
          sourceGeneration: 1,
        },
        env,
      ),
    ).rejects.toThrow("Invalid room history authority claims");
  });
});
