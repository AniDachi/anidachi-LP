import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { handleOAuthCallback } from "./handle-oauth-callback";
import {
  buildDiscordAuthUrl,
  exchangeDiscordCode,
} from "./oauth/discord";
import { buildGoogleAuthUrl, exchangeGoogleCode } from "./oauth/google";
import {
  handleDiscordOAuthStart,
  handleGoogleOAuthStart,
} from "./oauth-start";
import {
  oauthCorrelationCookieName,
  type OAuthLoginTransactionStart,
} from "./oauth-transaction";

const originalFetch = globalThis.fetch;
const originalEnv = {
  ANIDACHI_GOOGLE_CLIENT_ID: process.env.ANIDACHI_GOOGLE_CLIENT_ID,
  ANIDACHI_GOOGLE_CLIENT_SECRET: process.env.ANIDACHI_GOOGLE_CLIENT_SECRET,
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("browser OAuth routes", () => {
  it("starts Google and Discord with S256 and independent transaction cookies", async () => {
    process.env.ANIDACHI_GOOGLE_CLIENT_ID = "google-client";
    process.env.ANIDACHI_GOOGLE_CLIENT_SECRET = "google-secret";
    process.env.DISCORD_CLIENT_ID = "discord-client";
    process.env.DISCORD_CLIENT_SECRET = "discord-secret";
    const starts = [
      fixedStart(secret(1), secret(2), secret(3)),
      fixedStart(secret(4), secret(5), secret(6)),
    ];

    const google = await handleGoogleOAuthStart(
      new NextRequest(
        "https://staging.anidachi.app/api/auth/google?returnTo=%2Faccount%2Fwatch-library",
      ),
      { createTransaction: async () => starts[0] },
    );
    const discord = await handleDiscordOAuthStart(
      new NextRequest(
        "https://staging.anidachi.app/api/auth/discord?returnTo=%2Faccount",
      ),
      { createTransaction: async () => starts[1] },
    );

    const googleUrl = new URL(google.headers.get("location") ?? "");
    const discordUrl = new URL(discord.headers.get("location") ?? "");
    assert.equal(googleUrl.searchParams.get("state"), starts[0].state);
    assert.equal(googleUrl.searchParams.get("code_challenge"), starts[0].codeChallenge);
    assert.equal(googleUrl.searchParams.get("code_challenge_method"), "S256");
    assert.equal(discordUrl.searchParams.get("state"), starts[1].state);
    assert.equal(discordUrl.searchParams.get("code_challenge"), starts[1].codeChallenge);
    assert.equal(discordUrl.searchParams.get("code_challenge_method"), "S256");

    assert.equal(
      google.cookies.get(starts[0].correlationCookieName)?.value,
      starts[0].correlationSecret,
    );
    assert.equal(
      discord.cookies.get(starts[1].correlationCookieName)?.value,
      starts[1].correlationSecret,
    );
    assert.notEqual(starts[0].correlationCookieName, starts[1].correlationCookieName);
    const googleSetCookie = google.headers.get("set-cookie") ?? "";
    assert.match(googleSetCookie, /HttpOnly/i);
    assert.match(googleSetCookie, /Path=\/api\/auth\/callback\/google/i);
    assert.match(googleSetCookie, /SameSite=lax/i);
    assert.match(googleSetCookie, /Max-Age=600/i);
  });

  it("consumes the exact transaction before exchange and clears only its cookie", async () => {
    const state = secret(7);
    const correlationSecret = secret(8);
    const cookieName = oauthCorrelationCookieName(state);
    const calls: string[] = [];
    const response = await handleOAuthCallback({
      provider: "google",
      request: callbackRequest("google", state, correlationSecret, "code-1"),
      exchangeFn: async (code, origin, codeVerifier) => {
        calls.push(`exchange:${code}:${origin}:${codeVerifier}`);
        return profile("google-user");
      },
      dependencies: {
        consumeTransaction: async (input) => {
          calls.push(`consume:${input.provider}:${input.state}`);
          return { returnTo: "/account/watch-library", codeVerifier: "V".repeat(43) };
        },
        upsertUser: async () => {
          calls.push("upsert");
          return { id: "user-1" } as never;
        },
        issueTokenPair: async () => {
          calls.push("tokens");
          return { accessToken: "access", refreshToken: "refresh" };
        },
        setAuthCookies: () => {
          calls.push("cookies");
        },
      },
    });

    assert.deepEqual(calls, [
      `consume:google:${state}`,
      `exchange:code-1:https://staging.anidachi.app:${"V".repeat(43)}`,
      "upsert",
      "tokens",
      "cookies",
    ]);
    assert.equal(
      response.headers.get("location"),
      "https://staging.anidachi.app/account/watch-library",
    );
    assert.equal(response.cookies.get(cookieName)?.value, "");
    assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/i);
  });

  it("rejects cross-provider swaps and callback replays before exchange", async () => {
    const state = secret(9);
    const correlationSecret = secret(10);
    let exchanges = 0;
    const exchangeFn = async () => {
      exchanges += 1;
      return profile("never");
    };

    const swapped = await handleOAuthCallback({
      provider: "discord",
      request: callbackRequest("discord", state, correlationSecret, "code-2"),
      exchangeFn,
      dependencies: {
        consumeTransaction: async () => null,
      },
    });
    const replayed = await handleOAuthCallback({
      provider: "google",
      request: callbackRequest("google", state, correlationSecret, "code-3"),
      exchangeFn,
      dependencies: {
        consumeTransaction: async () => null,
      },
    });

    assert.equal(exchanges, 0);
    assert.equal(
      swapped.headers.get("location"),
      "https://staging.anidachi.app/login?error=invalid_state",
    );
    assert.equal(
      replayed.headers.get("location"),
      "https://staging.anidachi.app/login?error=invalid_state",
    );
  });

  it("consumes and clears a valid transaction when the provider callback fails", async () => {
    const state = secret(11);
    const correlationSecret = secret(12);
    let consumed = 0;
    const request = new NextRequest(
      `https://staging.anidachi.app/api/auth/callback/google?error=access_denied&state=${state}`,
      {
        headers: {
          cookie: `${oauthCorrelationCookieName(state)}=${correlationSecret}`,
        },
      },
    );
    const response = await handleOAuthCallback({
      provider: "google",
      request,
      exchangeFn: async () => profile("never"),
      dependencies: {
        consumeTransaction: async () => {
          consumed += 1;
          return { returnTo: "/account", codeVerifier: "M".repeat(43) };
        },
      },
    });

    assert.equal(consumed, 1);
    assert.equal(
      response.headers.get("location"),
      "https://staging.anidachi.app/login?error=oauth_failed",
    );
    assert.equal(
      response.cookies.get(oauthCorrelationCookieName(state))?.value,
      "",
    );
  });

  it("clears only the attempted transaction cookie when durable consume fails", async () => {
    const state = secret(13);
    const correlationSecret = secret(14);
    const cookieName = oauthCorrelationCookieName(state);
    const response = await handleOAuthCallback({
      provider: "google",
      request: callbackRequest("google", state, correlationSecret, "code-4"),
      exchangeFn: async () => profile("never"),
      dependencies: {
        consumeTransaction: async () => {
          throw new Error("database unavailable");
        },
      },
    });

    assert.equal(
      response.headers.get("location"),
      "https://staging.anidachi.app/login?error=oauth_failed",
    );
    assert.equal(response.cookies.get(cookieName)?.value, "");
    assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/i);
  });

  it("sends the derived verifier in both provider token exchanges", async () => {
    process.env.ANIDACHI_GOOGLE_CLIENT_ID = "google-client";
    process.env.ANIDACHI_GOOGLE_CLIENT_SECRET = "google-secret";
    process.env.DISCORD_CLIENT_ID = "discord-client";
    process.env.DISCORD_CLIENT_SECRET = "discord-secret";
    const bodies: URLSearchParams[] = [];
    globalThis.fetch = async (_input, init) => {
      bodies.push(new URLSearchParams(String(init?.body ?? "")));
      if (bodies.length === 1 || bodies.length === 3) {
        return Response.json({ access_token: "provider-access" });
      }
      return Response.json({
        sub: "google-user",
        id: "discord-user",
        email: "user@example.test",
        verified: true,
        name: "User",
        username: "User",
      });
    };

    await exchangeGoogleCode(
      "google-code",
      "https://staging.anidachi.app",
      "google-verifier",
    );
    await exchangeDiscordCode(
      "discord-code",
      "https://staging.anidachi.app",
      "discord-verifier",
    );

    assert.equal(bodies[0].get("code_verifier"), "google-verifier");
    assert.equal(bodies[2].get("code_verifier"), "discord-verifier");
  });

  it("provider URL builders require the S256 challenge", () => {
    process.env.ANIDACHI_GOOGLE_CLIENT_ID = "google-client";
    process.env.ANIDACHI_GOOGLE_CLIENT_SECRET = "google-secret";
    process.env.DISCORD_CLIENT_ID = "discord-client";
    process.env.DISCORD_CLIENT_SECRET = "discord-secret";
    const google = new URL(
      buildGoogleAuthUrl("state", "https://staging.anidachi.app", "challenge"),
    );
    const discord = new URL(
      buildDiscordAuthUrl("state", "https://staging.anidachi.app", "challenge"),
    );

    for (const url of [google, discord]) {
      assert.equal(url.searchParams.get("code_challenge"), "challenge");
      assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    }
  });
});

function fixedStart(
  state: string,
  correlationSecret: string,
  codeChallenge: string,
): OAuthLoginTransactionStart {
  return {
    state,
    correlationSecret,
    correlationCookieName: oauthCorrelationCookieName(state),
    codeChallenge,
    codeChallengeMethod: "S256",
  };
}

function callbackRequest(
  provider: "discord" | "google",
  state: string,
  correlationSecret: string,
  code: string,
): NextRequest {
  return new NextRequest(
    `https://staging.anidachi.app/api/auth/callback/${provider}?code=${code}&state=${state}`,
    {
      headers: {
        cookie: `${oauthCorrelationCookieName(state)}=${correlationSecret}`,
      },
    },
  );
}

function profile(providerId: string) {
  return {
    providerId,
    email: "user@example.test",
    displayName: "User",
    avatarUrl: null,
  };
}

function secret(byte: number): string {
  return Buffer.alloc(32, byte).toString("base64url");
}
