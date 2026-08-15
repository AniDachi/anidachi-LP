import assert from "node:assert/strict";
import test from "node:test";
import { SignJWT } from "jose";
import {
  WatchHistoryAuthorityError,
  verifyWatchHistoryAuthority,
} from "./watch-history-authority";

const SECRET = new TextEncoder().encode("test-history-authority-secret-at-least-32-bytes");
const OTHER_SECRET = new TextEncoder().encode("other-history-authority-secret-at-least-32-bytes");
const USER_ID = "11111111-1111-4111-8111-111111111111";

const visibleAuthority = {
  roomId: "room-one",
  participantSessionId: "participant-session-one",
  roomGeneration: 2,
  sourceGeneration: 3,
};

async function token(
  overrides: Record<string, unknown> = {},
  options: { secret?: Uint8Array; audience?: string; issuer?: string } = {},
) {
  const payload = {
    typ: "room_history",
    roomId: visibleAuthority.roomId,
    participantSessionId: visibleAuthority.participantSessionId,
    roomGeneration: visibleAuthority.roomGeneration,
    sourceGeneration: visibleAuthority.sourceGeneration,
    ...overrides,
  };
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(options.issuer ?? "anidachi-worker")
    .setAudience(options.audience ?? "anidachi-web-history")
    .setSubject(typeof overrides.sub === "string" ? overrides.sub : USER_ID)
    .setIssuedAt(1_786_680_000)
    .sign(options.secret ?? SECRET);
}

async function verify(
  overrides: Partial<typeof visibleAuthority> = {},
  tokenOverrides: Record<string, unknown> = {},
  options: { secret?: Uint8Array; audience?: string; issuer?: string } = {},
) {
  return verifyWatchHistoryAuthority({
    authenticatedUserId: USER_ID,
    authority: {
      ...visibleAuthority,
      ...overrides,
      attestation: await token(tokenOverrides, options),
    },
    secret: SECRET,
  });
}

test("history authority returns only validated purpose-bound claims", async () => {
  assert.deepEqual(await verify(), {
    sub: USER_ID,
    roomId: "room-one",
    participantSessionId: "participant-session-one",
    roomGeneration: 2,
    sourceGeneration: 3,
    iat: 1_786_680_000,
  });
});

test("history authority rejects a wrong signature and an ordinary room token", async () => {
  const wrongSignature = await token({}, { secret: OTHER_SECRET });
  await assert.rejects(
    () =>
      verifyWatchHistoryAuthority({
        authenticatedUserId: USER_ID,
        authority: {
          ...visibleAuthority,
          attestation: wrongSignature,
        },
        secret: SECRET,
      }),
    isInvalidAuthority,
  );
  await assert.rejects(
    () => verify({}, { typ: "room" }, { audience: "anidachi-worker" }),
    isInvalidAuthority,
  );
});

test("history authority rejects the wrong purpose, issuer, or audience", async () => {
  await assert.rejects(() => verify({}, { typ: "room" }), isInvalidAuthority);
  await assert.rejects(
    () => verify({}, {}, { issuer: "another-issuer" }),
    isInvalidAuthority,
  );
  await assert.rejects(
    () => verify({}, {}, { audience: "another-audience" }),
    isInvalidAuthority,
  );
});

test("history authority rejects unapproved signed payload fields", async () => {
  await assert.rejects(
    () => verify({}, { email: "private@example.com" }),
    isInvalidAuthority,
  );
});

test("history authority binds account, room, session, and both generations", async () => {
  await assert.rejects(() => verify({}, { sub: "22222222-2222-4222-8222-222222222222" }), isInvalidAuthority);
  await assert.rejects(() => verify({ roomId: "room-two" }), isInvalidAuthority);
  await assert.rejects(
    () => verify({ participantSessionId: "another-session" }),
    isInvalidAuthority,
  );
  await assert.rejects(() => verify({ roomGeneration: 4 }), isInvalidAuthority);
  await assert.rejects(() => verify({ sourceGeneration: 4 }), isInvalidAuthority);
});

function isInvalidAuthority(error: unknown) {
  return (
    error instanceof WatchHistoryAuthorityError &&
    error.code === "INVALID_AUTHORITY" &&
    !error.message.includes("token") &&
    !error.message.includes("JWT")
  );
}
