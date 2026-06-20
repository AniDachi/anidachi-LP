import { describe, expect, it } from "vitest";
import {
  assertExtensionLogoutRedirect,
  buildExtensionConnectUrl,
  buildExtensionLogoutUrl,
  createAuthMessage,
  isAuthMessage,
  normalizeExtensionRefreshResponse,
  parseExtensionAuthRedirect,
} from "../src/auth-client";
import {
  AUTH_TOKENS_KEY,
  AUTH_TOKENS_STORAGE_KEY,
  normalizeAuthenticatedUser,
  normalizeExtensionAuthTokens,
} from "../src/auth-tokens";

describe("extension auth client", () => {
  it("builds the website extension connect URL", () => {
    const url = new URL(buildExtensionConnectUrl("https://abc.chromiumapp.org/auth", "state-1"));

    expect(url.origin).toBe("http://localhost:3003");
    expect(url.pathname).toBe("/extension/connect");
    expect(url.searchParams.get("redirect_uri")).toBe("https://abc.chromiumapp.org/auth");
    expect(url.searchParams.get("state")).toBe("state-1");
  });

  it("builds the website extension logout URL", () => {
    const url = new URL(buildExtensionLogoutUrl("https://abc.chromiumapp.org/logout", "state-2"));

    expect(url.origin).toBe("http://localhost:3003");
    expect(url.pathname).toBe("/extension/logout");
    expect(url.searchParams.get("redirect_uri")).toBe("https://abc.chromiumapp.org/logout");
    expect(url.searchParams.get("state")).toBe("state-2");
  });

  it("parses a valid extension redirect", () => {
    expect(
      parseExtensionAuthRedirect(
        "https://abc.chromiumapp.org/auth?code=code-1&state=state-1",
        "state-1",
      ),
    ).toEqual({ code: "code-1", state: "state-1" });
  });

  it("rejects redirect state mismatches", () => {
    expect(() =>
      parseExtensionAuthRedirect(
        "https://abc.chromiumapp.org/auth?code=code-1&state=wrong",
        "state-1",
      ),
    ).toThrow("Invalid extension auth state");
  });

  it("validates extension logout redirects", () => {
    expect(() =>
      assertExtensionLogoutRedirect(
        "https://abc.chromiumapp.org/logout?signed_out=1&state=state-2",
        "state-2",
      ),
    ).not.toThrow();
    expect(() =>
      assertExtensionLogoutRedirect(
        "https://abc.chromiumapp.org/logout?signed_out=1&state=wrong",
        "state-2",
      ),
    ).toThrow("Invalid extension logout state");
  });

  it("validates auth runtime messages", () => {
    expect(isAuthMessage(createAuthMessage("sign-in"))).toBe(true);
    expect(isAuthMessage({ type: "ANIDACHI_AUTH", command: "unknown" })).toBe(false);
    expect(isAuthMessage({ command: "sign-in" })).toBe(false);
  });

  it("normalizes extension refresh responses with optional refresh tokens", () => {
    expect(
      normalizeExtensionRefreshResponse({
        accessToken: "access-2",
        refreshToken: "refresh-2",
      }),
    ).toEqual({ accessToken: "access-2", refreshToken: "refresh-2" });

    expect(
      normalizeExtensionRefreshResponse({
        accessToken: "access-only",
      }),
    ).toEqual({ accessToken: "access-only" });

    expect(
      normalizeExtensionRefreshResponse({
        accessToken: "access",
        refreshToken: 123,
      }),
    ).toBeNull();
  });

  it("keeps the WXT auth key and raw storage key aligned", () => {
    expect(AUTH_TOKENS_STORAGE_KEY).toBe("authTokens");
    expect(AUTH_TOKENS_KEY).toBe("local:authTokens");
  });

  it("normalizes valid token responses", () => {
    expect(
      normalizeExtensionAuthTokens({
        accessToken: "access",
        refreshToken: "refresh",
        user: {
          id: "user-1",
          email: "user@example.com",
          displayName: "Alina",
          avatarUrl: null,
          plan: "watcher",
        },
      }),
    ).toEqual({
      accessToken: "access",
      refreshToken: "refresh",
      user: {
        id: "user-1",
        email: "user@example.com",
        displayName: "Alina",
        avatarUrl: null,
        plan: "watcher",
      },
    });
  });

  it("rejects malformed users", () => {
    expect(normalizeAuthenticatedUser({ id: "user-1", plan: "watcher" })).toBeNull();
    expect(
      normalizeAuthenticatedUser({
        id: "user-1",
        email: "user@example.com",
        displayName: "Alina",
        avatarUrl: null,
        plan: "admin",
      }),
    ).toBeNull();
  });
});
