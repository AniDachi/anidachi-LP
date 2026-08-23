import assert from "node:assert/strict";
import test from "node:test";
import { decodeJwt, decodeProtectedHeader, SignJWT } from "jose";
import { ROOM_TOKEN_AUDIENCE, ROOM_TOKEN_ISSUER } from "@anidachi/protocol";
import {
  signExtensionAccessToken,
  verifyExtensionAccessToken,
} from "./extension-session";
import {
  signAccessToken,
  signRoomToken,
  verifyAccessToken,
  verifyRoomToken,
} from "./jwt";

const TEST_SECRET = "test-secret-for-anidachi-jwt-bridge";

function testSecret(): Uint8Array {
  return new TextEncoder().encode(TEST_SECRET);
}

async function withJwtSecret<T>(fn: () => Promise<T>): Promise<T> {
  const previous = process.env.ANIDACHI_JWT_SECRET;
  process.env.ANIDACHI_JWT_SECRET = TEST_SECRET;
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.ANIDACHI_JWT_SECRET;
    else process.env.ANIDACHI_JWT_SECRET = previous;
  }
}

test("access tokens verify with canonical plan codes", async () => {
  await withJwtSecret(async () => {
    const token = await signAccessToken({
      sub: "user-1",
      email: "user@example.com",
      plan: "plus",
    });

    const payload = await verifyAccessToken(token);
    assert.equal(payload?.plan, "plus");
  });
});

test("website access tokens carry the exact channel and lifetime claims", async () => {
  await withJwtSecret(async () => {
    const token = await signAccessToken({
      sub: "user-1",
      email: "user@example.com",
      plan: "plus",
    });

    const header = decodeProtectedHeader(token);
    const payload = decodeJwt(token);
    assert.equal(header.alg, "HS256");
    assert.equal(payload.iss, "anidachi-auth");
    assert.equal(payload.aud, "anidachi-web");
    assert.equal(payload.typ, "website_access");
    assert.equal(payload.sub, "user-1");
    assert.equal(typeof payload.iat, "number");
    assert.equal(typeof payload.exp, "number");
  });
});

test("access verifiers reject cross-channel tokens", async () => {
  await withJwtSecret(async () => {
    const websiteToken = await signAccessToken({
      sub: "user-1",
      email: "user@example.com",
      plan: "plus",
    });
    const extensionToken = await signExtensionAccessToken({
      sub: "user-1",
      email: "user@example.com",
      plan: "plus",
    });
    const extensionHeader = decodeProtectedHeader(extensionToken);
    const extensionPayload = decodeJwt(extensionToken);

    assert.equal(extensionHeader.alg, "HS256");
    assert.equal(extensionPayload.iss, "anidachi-auth");
    assert.equal(extensionPayload.aud, "anidachi-extension");
    assert.equal(extensionPayload.typ, "extension_access");
    assert.equal(extensionPayload.sub, "user-1");
    assert.equal(typeof extensionPayload.iat, "number");
    assert.equal(typeof extensionPayload.exp, "number");
    assert.equal(await verifyAccessToken(extensionToken), null);
    assert.equal(await verifyExtensionAccessToken(websiteToken), null);
    assert.deepEqual(await verifyExtensionAccessToken(extensionToken), {
      sub: "user-1",
      email: "user@example.com",
      plan: "plus",
    });
  });
});

test("extension verifier rejects wrong or missing protected claims", async () => {
  await withJwtSecret(async () => {
    const now = Math.floor(Date.now() / 1000);
    const validClaims = {
      iss: "anidachi-auth",
      aud: "anidachi-extension",
      typ: "extension_access",
      sub: "user-1",
      iat: now,
      exp: now + 300,
      email: "user@example.com",
      plan: "plus",
    };
    const cases: Array<{ claims: Record<string, unknown>; alg?: "HS256" | "HS384" }> = [
      { claims: { ...validClaims, iss: "wrong-issuer" } },
      { claims: { ...validClaims, aud: "anidachi-web" } },
      { claims: { ...validClaims, aud: ["anidachi-extension", "anidachi-web"] } },
      { claims: { ...validClaims, typ: "website_access" } },
      { claims: { ...validClaims, sub: undefined } },
      { claims: { ...validClaims, iat: undefined } },
      { claims: { ...validClaims, exp: undefined } },
      { claims: { ...validClaims, email: 42 } },
      { claims: { ...validClaims, plan: "admin" } },
      { claims: { ...validClaims }, alg: "HS384" },
    ];

    for (const fixture of cases) {
      const token = await new SignJWT(fixture.claims)
        .setProtectedHeader({ alg: fixture.alg ?? "HS256" })
        .sign(testSecret());
      assert.equal(await verifyExtensionAccessToken(token), null);
    }
  });
});

test("website verifier rejects wrong or missing protected claims", async () => {
  await withJwtSecret(async () => {
    const now = Math.floor(Date.now() / 1000);
    const validClaims = {
      iss: "anidachi-auth",
      aud: "anidachi-web",
      typ: "website_access",
      sub: "user-1",
      iat: now,
      exp: now + 300,
      email: "user@example.com",
      plan: "plus",
    };
    const cases: Array<{ claims: Record<string, unknown>; alg?: "HS256" | "HS384" }> = [
      { claims: { ...validClaims, iss: "wrong-issuer" } },
      { claims: { ...validClaims, aud: "anidachi-extension" } },
      { claims: { ...validClaims, aud: ["anidachi-web", "anidachi-extension"] } },
      { claims: { ...validClaims, typ: "extension_access" } },
      { claims: { ...validClaims, sub: undefined } },
      { claims: { ...validClaims, iat: undefined } },
      { claims: { ...validClaims, exp: undefined } },
      { claims: { ...validClaims, email: 42 } },
      { claims: { ...validClaims, plan: "admin" } },
      { claims: { ...validClaims }, alg: "HS384" },
    ];

    for (const fixture of cases) {
      const token = await new SignJWT(fixture.claims)
        .setProtectedHeader({ alg: fixture.alg ?? "HS256" })
        .sign(testSecret());
      assert.equal(await verifyAccessToken(token), null);
    }
  });
});

test("access tokens normalize legacy plan codes during bridge window", async () => {
  await withJwtSecret(async () => {
    const token = await signAccessToken({
      sub: "user-1",
      email: "user@example.com",
      plan: "nakama" as never,
    });

    const payload = await verifyAccessToken(token);
    assert.equal(payload?.plan, "plus");
  });
});

test("room tokens bind the exact participant tab session", async () => {
  await withJwtSecret(async () => {
    const token = await signRoomToken({
      sub: "user-1",
      roomId: "room-1",
      role: "member",
      participantSessionId: "participant-session-1",
    });

    const claims = decodeJwt(token);
    assert.equal(claims.iss, ROOM_TOKEN_ISSUER);
    assert.equal(claims.aud, ROOM_TOKEN_AUDIENCE);
    assert.equal(claims.participantSessionId, "participant-session-1");
    assert.deepEqual(await verifyRoomToken(token), {
      sub: "user-1",
      roomId: "room-1",
      role: "member",
      participantSessionId: "participant-session-1",
      capabilities: undefined,
      displayName: undefined,
      avatarUrl: null,
    });
  });
});

test("room-token verification fails closed without one bounded session binding", async () => {
  await withJwtSecret(async () => {
    const now = Math.floor(Date.now() / 1000);
    const validClaims = {
      iss: ROOM_TOKEN_ISSUER,
      aud: ROOM_TOKEN_AUDIENCE,
      typ: "room",
      sub: "user-1",
      iat: now,
      exp: now + 300,
      roomId: "room-1",
      role: "member",
      participantSessionId: "participant-session-1",
    };
    for (const claims of [
      { ...validClaims, participantSessionId: undefined },
      { ...validClaims, participantSessionId: "" },
      { ...validClaims, participantSessionId: "x".repeat(129) },
      { ...validClaims, participantSessionId: 42 },
    ]) {
      const token = await new SignJWT(claims)
        .setProtectedHeader({ alg: "HS256" })
        .sign(testSecret());
      assert.equal(await verifyRoomToken(token), null);
    }
  });
});
