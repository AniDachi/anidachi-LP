import assert from "node:assert/strict";
import { hkdfSync } from "node:crypto";
import { afterEach, describe, it } from "node:test";
import { EncryptJWT } from "jose";
import {
  EXTENSION_AUTH_HANDOFF_TTL_SECONDS,
  createExtensionAuthLoginRedirect,
  openExtensionAuthHandoff,
} from "./extension-auth-handoff";
import { createOAuthLoginTransaction } from "./oauth-transaction";
import type { OAuthLoginTransactionRepository } from "./oauth-transaction";

type ExtensionAuthQuery = {
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge: string;
  code_challenge_method: "S256";
};

const originalJwtSecret = process.env.ANIDACHI_JWT_SECRET;
const testSecret = "extension-auth-handoff-test-secret";
const start = new Date("2026-08-19T00:00:00.000Z");
const input: ExtensionAuthQuery = {
  client_id: "ndkfphbchhfephdodcpehdcoclojagje",
  redirect_uri:
    "https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/auth",
  state: "S".repeat(43),
  code_challenge: "C".repeat(43),
  code_challenge_method: "S256",
};

afterEach(() => {
  if (originalJwtSecret === undefined) delete process.env.ANIDACHI_JWT_SECRET;
  else process.env.ANIDACHI_JWT_SECRET = originalJwtSecret;
});

describe("extension authorization login handoff", () => {
  it("keeps raw extension parameters out of unauthenticated login and OAuth storage", async () => {
    process.env.ANIDACHI_JWT_SECRET = testSecret;
    const issuedAt = new Date();
    const loginRedirect = await createExtensionAuthLoginRedirect(
      input,
      issuedAt,
    );
    for (const rawValue of [input.state, input.redirect_uri, input.code_challenge]) {
      assert.ok(!loginRedirect.includes(rawValue));
      assert.ok(!loginRedirect.includes(encodeURIComponent(rawValue)));
    }

    const loginUrl = new URL(loginRedirect, "https://staging.anidachi.app");
    assert.equal(loginUrl.pathname, "/login");
    const next = loginUrl.searchParams.get("next");
    assert.ok(next);
    const resumeUrl = new URL(next, "https://staging.anidachi.app");
    assert.equal(resumeUrl.pathname, "/extension/connect");
    assert.deepEqual([...resumeUrl.searchParams.keys()], ["handoff"]);
    const envelope = resumeUrl.searchParams.get("handoff");
    assert.match(
      envelope ?? "",
      /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    );

    const stored: Array<Record<string, string>> = [];
    await createOAuthLoginTransaction({
      provider: "discord",
      returnTo: next,
      repository: captureOnlyRepository(stored),
    });
    assert.equal(stored[0].returnTo, next);
    for (const rawValue of [input.state, input.redirect_uri, input.code_challenge]) {
      assert.ok(!Object.values(stored[0]).some((value) => value.includes(rawValue)));
    }

    assert.deepEqual(
      await openExtensionAuthHandoff(
        envelope ?? "",
        new Date(issuedAt.getTime() + 1_000),
      ),
      input,
    );
  });

  it("fails closed for tampered, expired, and wrong-purpose handoffs", async () => {
    process.env.ANIDACHI_JWT_SECRET = testSecret;
    const loginRedirect = await createExtensionAuthLoginRedirect(input, start);
    const next = new URL(loginRedirect, "https://staging.anidachi.app").searchParams.get(
      "next",
    );
    const envelope = new URL(next ?? "", "https://staging.anidachi.app").searchParams.get(
      "handoff",
    );
    assert.ok(envelope);

    const replacement = envelope.endsWith("A") ? "B" : "A";
    const tampered = `${envelope.slice(0, -1)}${replacement}`;
    assert.equal(await openExtensionAuthHandoff(tampered, start), null);
    assert.equal(
      await openExtensionAuthHandoff(
        envelope,
        new Date(
          start.getTime() +
            (EXTENSION_AUTH_HANDOFF_TTL_SECONDS + 1) * 1_000,
        ),
      ),
      null,
    );

    const issuedAt = Math.floor(start.getTime() / 1_000);
    const wrongPurpose = await new EncryptJWT({
      purpose: "not-extension-auth",
      request: input,
    })
      .setProtectedHeader({
        alg: "dir",
        enc: "A256GCM",
        typ: "anidachi-extension-auth-handoff+jwt",
      })
      .setIssuer("anidachi-web")
      .setAudience("anidachi-extension-connect")
      .setIssuedAt(issuedAt)
      .setNotBefore(issuedAt)
      .setExpirationTime(issuedAt + EXTENSION_AUTH_HANDOFF_TTL_SECONDS)
      .encrypt(deriveTestHandoffKey(testSecret));
    assert.equal(await openExtensionAuthHandoff(wrongPurpose, start), null);

    const wrongAudience = await new EncryptJWT({
      purpose: "extension-auth-login-handoff",
      request: input,
    })
      .setProtectedHeader({
        alg: "dir",
        enc: "A256GCM",
        typ: "anidachi-extension-auth-handoff+jwt",
      })
      .setIssuer("anidachi-web")
      .setAudience("not-extension-connect")
      .setIssuedAt(issuedAt)
      .setNotBefore(issuedAt)
      .setExpirationTime(issuedAt + EXTENSION_AUTH_HANDOFF_TTL_SECONDS)
      .encrypt(deriveTestHandoffKey(testSecret));
    assert.equal(await openExtensionAuthHandoff(wrongAudience, start), null);
  });
});

function deriveTestHandoffKey(secret: string): Uint8Array {
  return new Uint8Array(
    hkdfSync(
      "sha256",
      Buffer.from(secret, "utf8"),
      Buffer.from("anidachi-extension-auth-handoff-v1", "utf8"),
      Buffer.from("encrypted-browser-handoff", "utf8"),
      32,
    ),
  );
}

function captureOnlyRepository(
  stored: Array<Record<string, string>>,
): OAuthLoginTransactionRepository {
  return {
    async create(value) {
      stored.push({ ...value });
    },
    async consume() {
      return null;
    },
  };
}
