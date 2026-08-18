import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { afterEach, describe, it } from "node:test";
import {
  OAUTH_LOGIN_TRANSACTION_TTL_SECONDS,
  consumeOAuthLoginTransaction,
  createOAuthLoginTransaction,
  deriveOAuthPkceChallenge,
  deriveOAuthPkceVerifier,
  oauthCorrelationCookieName,
  oauthCorrelationCookiePath,
  type OAuthLoginTransactionRepository,
} from "./oauth-transaction";

const originalJwtSecret = process.env.ANIDACHI_JWT_SECRET;

afterEach(() => {
  if (originalJwtSecret === undefined) {
    delete process.env.ANIDACHI_JWT_SECRET;
  } else {
    process.env.ANIDACHI_JWT_SECRET = originalJwtSecret;
  }
});

describe("browser OAuth login transactions", () => {
  it("uses independent 256-bit state and browser-correlation secrets", async () => {
    process.env.ANIDACHI_JWT_SECRET = "oauth-transaction-test-secret";
    const stored: Array<Record<string, string>> = [];
    const repository = captureOnlyRepository(stored);

    const first = await createOAuthLoginTransaction({
      provider: "google",
      returnTo: "/account",
      repository,
    });
    const second = await createOAuthLoginTransaction({
      provider: "google",
      returnTo: "/account",
      repository,
    });

    assert.equal(Buffer.from(first.state, "base64url").byteLength, 32);
    assert.equal(Buffer.from(first.correlationSecret, "base64url").byteLength, 32);
    assert.notEqual(first.state, first.correlationSecret);
    assert.notEqual(first.state, second.state);
    assert.notEqual(first.correlationSecret, second.correlationSecret);
    assert.notEqual(first.correlationCookieName, second.correlationCookieName);
    assert.equal(first.codeChallengeMethod, "S256");
    assert.equal(OAUTH_LOGIN_TRANSACTION_TTL_SECONDS, 10 * 60);
  });

  it("stores only hashes plus the provider and sanitized return path", async () => {
    process.env.ANIDACHI_JWT_SECRET = "oauth-transaction-test-secret";
    const stored: Array<Record<string, string>> = [];
    const repository = captureOnlyRepository(stored);

    const transaction = await createOAuthLoginTransaction({
      provider: "discord",
      returnTo: "https://attacker.example/steal",
      repository,
    });

    assert.equal(stored.length, 1);
    assert.deepEqual(Object.keys(stored[0]).sort(), [
      "browserCorrelationHash",
      "provider",
      "returnTo",
      "stateHash",
    ]);
    assert.match(stored[0].stateHash, /^[a-f0-9]{64}$/);
    assert.match(stored[0].browserCorrelationHash, /^[a-f0-9]{64}$/);
    assert.equal(stored[0].provider, "discord");
    assert.equal(stored[0].returnTo, "");
    assert.ok(!Object.values(stored[0]).includes(transaction.state));
    assert.ok(!Object.values(stored[0]).includes(transaction.correlationSecret));
    assert.ok(
      !Object.values(stored[0]).includes(
        deriveOAuthPkceVerifier(transaction.state),
      ),
    );
  });

  it("derives an RFC 7636 S256 challenge from a server-only verifier", async () => {
    process.env.ANIDACHI_JWT_SECRET = "oauth-transaction-test-secret";
    const stored: Array<Record<string, string>> = [];
    const transaction = await createOAuthLoginTransaction({
      provider: "google",
      returnTo: "/account/watch-library",
      repository: captureOnlyRepository(stored),
    });

    const codeVerifier = deriveOAuthPkceVerifier(transaction.state);
    assert.equal(
      transaction.codeChallenge,
      deriveOAuthPkceChallenge(codeVerifier),
    );
    assert.equal(
      transaction.codeChallenge,
      createHash("sha256")
        .update(codeVerifier)
        .digest("base64url"),
    );
    assert.match(codeVerifier, /^[A-Za-z0-9_-]{43}$/);
  });

  it("binds consumption to provider, state, and browser correlation exactly once", async () => {
    process.env.ANIDACHI_JWT_SECRET = "oauth-transaction-test-secret";
    const rows = new Map<string, { provider: string; correlationHash: string; used: boolean }>();
    const repository: OAuthLoginTransactionRepository = {
      async create(input) {
        rows.set(input.stateHash, {
          provider: input.provider,
          correlationHash: input.browserCorrelationHash,
          used: false,
        });
      },
      async consume(input) {
        const row = rows.get(input.stateHash);
        if (
          !row ||
          row.used ||
          row.provider !== input.provider ||
          row.correlationHash !== input.browserCorrelationHash
        ) {
          return null;
        }
        row.used = true;
        return { returnTo: "/account" };
      },
    };
    const transaction = await createOAuthLoginTransaction({
      provider: "google",
      returnTo: "/account",
      repository,
    });

    assert.equal(
      await consumeOAuthLoginTransaction({
        provider: "discord",
        state: transaction.state,
        correlationSecret: transaction.correlationSecret,
        repository,
      }),
      null,
    );

    const consumed = await consumeOAuthLoginTransaction({
      provider: "google",
      state: transaction.state,
      correlationSecret: transaction.correlationSecret,
      repository,
    });
    assert.deepEqual(consumed, {
      returnTo: "/account",
      codeVerifier: deriveOAuthPkceVerifier(transaction.state),
    });
    assert.equal(
      await consumeOAuthLoginTransaction({
        provider: "google",
        state: transaction.state,
        correlationSecret: transaction.correlationSecret,
        repository,
      }),
      null,
    );
  });

  it("rejects malformed secrets before touching durable state", async () => {
    process.env.ANIDACHI_JWT_SECRET = "oauth-transaction-test-secret";
    let consumeCalls = 0;
    const repository: OAuthLoginTransactionRepository = {
      async create() {},
      async consume() {
        consumeCalls += 1;
        return { returnTo: "/account" };
      },
    };

    assert.equal(
      await consumeOAuthLoginTransaction({
        provider: "google",
        state: "not-base64url-state",
        correlationSecret: "also-invalid",
        repository,
      }),
      null,
    );
    assert.equal(consumeCalls, 0);
  });

  it("uses a transaction-scoped non-secret cookie selector and provider path", async () => {
    process.env.ANIDACHI_JWT_SECRET = "oauth-transaction-test-secret";
    const stored: Array<Record<string, string>> = [];
    const transaction = await createOAuthLoginTransaction({
      provider: "google",
      returnTo: "/account",
      repository: captureOnlyRepository(stored),
    });

    assert.equal(
      transaction.correlationCookieName,
      oauthCorrelationCookieName(transaction.state),
    );
    assert.match(transaction.correlationCookieName, /^anidachi_oauth_tx_[a-f0-9]{24}$/);
    assert.ok(!transaction.correlationCookieName.includes(transaction.state));
    assert.equal(oauthCorrelationCookiePath("google"), "/api/auth/callback/google");
    assert.equal(oauthCorrelationCookiePath("discord"), "/api/auth/callback/discord");
  });
});

function captureOnlyRepository(
  stored: Array<Record<string, string>>,
): OAuthLoginTransactionRepository {
  return {
    async create(input) {
      stored.push({ ...input });
    },
    async consume() {
      return null;
    },
  };
}
