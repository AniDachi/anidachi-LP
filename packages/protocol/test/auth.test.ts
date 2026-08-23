import { describe, expect, it } from "vitest";
import {
  EXTENSION_AUTH_CODE_MAX_CHARS,
  EXTENSION_AUTH_REDIRECT_URI_MAX_CHARS,
  EXTENSION_AUTH_STATE_MAX_CHARS,
  ExtensionAuthErrorSchema,
  ExtensionAuthExchangeRequestSchema,
  ExtensionAuthInitiationSchema,
} from "../src";

const initiation = {
  clientId: "ndkfphbchhfephdodcpehdcoclojagje",
  redirectUri: "https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/auth",
  state: "s".repeat(43),
  codeChallenge: "c".repeat(43),
  codeChallengeMethod: "S256",
} as const;

describe("extension auth protocol", () => {
  it("accepts the strict S256 initiation contract", () => {
    expect(ExtensionAuthInitiationSchema.parse(initiation)).toEqual(initiation);
  });

  it("rejects unknown initiation fields and non-canonical clients or redirects", () => {
    for (const input of [
      { ...initiation, unknown: true },
      { ...initiation, clientId: "a".repeat(31) },
      { ...initiation, clientId: "z".repeat(32) },
      { ...initiation, redirectUri: "https://attacker.chromiumapp.org/auth" },
      { ...initiation, redirectUri: `${initiation.redirectUri}?next=attacker` },
      { ...initiation, redirectUri: `${initiation.redirectUri}#fragment` },
      { ...initiation, codeChallengeMethod: "plain" },
    ]) {
      expect(ExtensionAuthInitiationSchema.safeParse(input).success).toBe(false);
    }
  });

  it("accepts the strict exchange contract and rejects unknown fields", () => {
    const exchange = {
      clientId: initiation.clientId,
      redirectUri: initiation.redirectUri,
      state: initiation.state,
      code: "a".repeat(43),
      codeVerifier: "v".repeat(43),
    };

    expect(ExtensionAuthExchangeRequestSchema.parse(exchange)).toEqual(exchange);
    expect(
      ExtensionAuthExchangeRequestSchema.safeParse({ ...exchange, extra: "field" }).success,
    ).toBe(false);
  });

  it("rejects oversized auth inputs", () => {
    expect(
      ExtensionAuthInitiationSchema.safeParse({
        ...initiation,
        redirectUri: `https://${"a".repeat(EXTENSION_AUTH_REDIRECT_URI_MAX_CHARS)}.example/auth`,
      }).success,
    ).toBe(false);
    expect(
      ExtensionAuthInitiationSchema.safeParse({
        ...initiation,
        state: "s".repeat(EXTENSION_AUTH_STATE_MAX_CHARS + 1),
      }).success,
    ).toBe(false);
    expect(
      ExtensionAuthExchangeRequestSchema.safeParse({
        clientId: initiation.clientId,
        redirectUri: initiation.redirectUri,
        state: initiation.state,
        code: "a".repeat(EXTENSION_AUTH_CODE_MAX_CHARS + 1),
        codeVerifier: "v".repeat(43),
      }).success,
    ).toBe(false);
  });

  it("defines stable public error codes", () => {
    for (const error of [
      "invalid_request",
      "invalid_client",
      "invalid_redirect_uri",
      "invalid_grant",
      "server_error",
    ]) {
      expect(ExtensionAuthErrorSchema.parse({ error })).toEqual({ error });
    }
    expect(ExtensionAuthErrorSchema.safeParse({ error: "unknown", detail: "leak" }).success).toBe(
      false,
    );
  });
});
