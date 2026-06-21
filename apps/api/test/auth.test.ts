import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { signRoomTokenForTest, verifyRoomToken } from "../src/auth";

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
});
