import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { afterEach, describe, it } from "node:test";
import {
  EXTENSION_AUTH_CODE_TTL_SECONDS,
  consumeExtensionAuthCode,
  createExtensionAuthCode,
  deriveExtensionPkceChallenge,
  isSafeExtensionRedirectUri,
  readApprovedExtensionClientId,
  type ExtensionAuthCodeRepository,
} from "./extension-codes";

const approvedClientId = "ndkfphbchhfephdodcpehdcoclojagje";
const approvedRedirectUri = `https://${approvedClientId}.chromiumapp.org/auth`;
const originalApprovedClientId = process.env.ANIDACHI_EXTENSION_CLIENT_ID;

afterEach(() => {
  if (originalApprovedClientId === undefined) {
    delete process.env.ANIDACHI_EXTENSION_CLIENT_ID;
  } else {
    process.env.ANIDACHI_EXTENSION_CLIENT_ID = originalApprovedClientId;
  }
});

describe("extension authorization codes", () => {
  it("rejects an arbitrary Chromium application callback before code issuance", () => {
    process.env.ANIDACHI_EXTENSION_CLIENT_ID = approvedClientId;
    assert.equal(
      isSafeExtensionRedirectUri("https://attacker-controlled.chromiumapp.org/auth"),
      false,
    );
  });

  it("accepts only the configured client and exact auth or logout callback", () => {
    process.env.ANIDACHI_EXTENSION_CLIENT_ID = approvedClientId;

    assert.equal(isSafeExtensionRedirectUri(approvedRedirectUri, "/auth"), true);
    assert.equal(
      isSafeExtensionRedirectUri(
        `https://${approvedClientId}.chromiumapp.org/logout`,
        "/logout",
      ),
      true,
    );
    for (const redirectUri of [
      `https://${approvedClientId}.chromiumapp.org/other`,
      `${approvedRedirectUri}?next=attacker`,
      `${approvedRedirectUri}#fragment`,
      `https://${approvedClientId}.chromiumapp.org:443/auth`,
      `https://user@${approvedClientId}.chromiumapp.org/auth`,
      `http://${approvedClientId}.chromiumapp.org/auth`,
    ]) {
      assert.equal(isSafeExtensionRedirectUri(redirectUri, "/auth"), false);
    }
  });

  it("fails closed when the configured client is absent or malformed", () => {
    delete process.env.ANIDACHI_EXTENSION_CLIENT_ID;
    assert.equal(readApprovedExtensionClientId(), null);
    assert.equal(isSafeExtensionRedirectUri(approvedRedirectUri, "/auth"), false);

    for (const value of ["", "a".repeat(31), "z".repeat(32), `${approvedClientId},other`]) {
      process.env.ANIDACHI_EXTENSION_CLIENT_ID = value;
      assert.equal(readApprovedExtensionClientId(), null);
    }
  });

  it("stores hashes and exact client, redirect, state, and challenge bindings", async () => {
    process.env.ANIDACHI_EXTENSION_CLIENT_ID = approvedClientId;
    const created: Array<Record<string, string>> = [];
    const repository: ExtensionAuthCodeRepository = {
      async create(input) {
        created.push({ ...input });
      },
      async consume() {
        return null;
      },
    };
    const state = "s".repeat(43);
    const codeVerifier = "v".repeat(43);
    const codeChallenge = deriveExtensionPkceChallenge(codeVerifier);

    const code = await createExtensionAuthCode({
      userId: "00000000-0000-4000-8000-000000000001",
      clientId: approvedClientId,
      redirectUri: approvedRedirectUri,
      state,
      codeChallenge,
      codeChallengeMethod: "S256",
      repository,
    });

    assert.equal(created.length, 1);
    assert.deepEqual(Object.keys(created[0]).sort(), [
      "clientId",
      "codeChallenge",
      "codeChallengeMethod",
      "codeHash",
      "redirectUri",
      "stateHash",
      "userId",
    ]);
    assert.equal(created[0].codeHash, createHash("sha256").update(code).digest("hex"));
    assert.equal(created[0].stateHash, createHash("sha256").update(state).digest("hex"));
    assert.ok(!Object.values(created[0]).includes(code));
    assert.ok(!Object.values(created[0]).includes(state));
    assert.ok(!Object.values(created[0]).includes(codeVerifier));
    assert.equal(created[0].clientId, approvedClientId);
    assert.equal(created[0].redirectUri, approvedRedirectUri);
    assert.equal(created[0].codeChallenge, codeChallenge);
    assert.equal(EXTENSION_AUTH_CODE_TTL_SECONDS, 5 * 60);
  });

  it("binds exchange to client, redirect, state, verifier, and one consumption", async () => {
    process.env.ANIDACHI_EXTENSION_CLIENT_ID = approvedClientId;
    const verifier = "v".repeat(43);
    const challenge = deriveExtensionPkceChallenge(verifier);
    let used = false;
    const repository: ExtensionAuthCodeRepository = {
      async create() {},
      async consume(input) {
        if (
          used ||
          input.clientId !== approvedClientId ||
          input.redirectUri !== approvedRedirectUri ||
          input.stateHash !== createHash("sha256").update("s".repeat(43)).digest("hex") ||
          input.codeChallenge !== challenge
        ) {
          return null;
        }
        used = true;
        return { userId: "00000000-0000-4000-8000-000000000001" };
      },
    };
    const request = {
      clientId: approvedClientId,
      redirectUri: approvedRedirectUri,
      state: "s".repeat(43),
      code: "a".repeat(43),
      codeVerifier: verifier,
      repository,
    };

    assert.equal(
      await consumeExtensionAuthCode({ ...request, codeVerifier: "x".repeat(43) }),
      null,
    );
    assert.equal(
      await consumeExtensionAuthCode({
        ...request,
        clientId: "nkinhhgigcflmfhilmcakbkongcpkfnl",
        redirectUri:
          "https://nkinhhgigcflmfhilmcakbkongcpkfnl.chromiumapp.org/auth",
      }),
      null,
    );
    assert.equal(
      await consumeExtensionAuthCode({
        ...request,
        redirectUri: `https://${approvedClientId}.chromiumapp.org/logout`,
      }),
      null,
    );
    assert.deepEqual(await consumeExtensionAuthCode(request), {
      userId: "00000000-0000-4000-8000-000000000001",
    });
    assert.equal(await consumeExtensionAuthCode(request), null);
  });
});
