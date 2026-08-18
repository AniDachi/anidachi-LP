import { describe, expect, it, vi } from "vitest";
import {
  assertExtensionLogoutRedirect,
  buildExtensionConnectUrl,
  buildExtensionLogoutUrl,
  clearExtensionSessionIfCurrent,
  createAuthMessage,
  createExtensionAuthTransaction,
  deriveExtensionPkceChallenge,
  ExtensionAuthTemporarilyUnavailableError,
  fetchWebsiteSessionProbe,
  getFastSessionAndRefreshInBackground,
  getCurrentExtensionSession,
  isAuthMessage,
  normalizeExtensionRefreshResponse,
  parseExtensionAuthRedirect,
  reconcileExtensionSessionAgainstWebsite,
  refreshExtensionSession,
  runWebsiteSignOutSequence,
  shouldClearExtensionSessionForWebsiteProbe,
  shouldClearExtensionSessionForWebsiteCookieChange,
  shouldSyncExtensionSessionForWebsiteCookieChange,
} from "../src/auth-client";
import {
  LOCAL_EXTENSION_ID,
  LOCAL_EXTENSION_MANIFEST_KEY,
  STAGING_EXTENSION_ID,
  STAGING_EXTENSION_MANIFEST_KEY,
  deriveChromiumExtensionId,
  getExtensionManifestKey,
} from "../src/extension-channel-identity";
import {
  AUTH_TOKENS_KEY,
  AUTH_TOKENS_STORAGE_KEY,
  type ExtensionAuthTokens,
  normalizeAuthenticatedUser,
  normalizeExtensionAuthTokens,
} from "../src/auth-tokens";

const storedTokens: ExtensionAuthTokens = {
  accessToken: "access",
  refreshToken: "refresh",
  user: {
    id: "user-1",
    email: "user@example.com",
    displayName: "Alina",
    avatarUrl: null,
    plan: "plus",
  },
};

describe("extension auth client", () => {
  it("builds the website extension connect URL", () => {
    const url = new URL(
      buildExtensionConnectUrl({
        clientId: STAGING_EXTENSION_ID,
        redirectUri: `https://${STAGING_EXTENSION_ID}.chromiumapp.org/auth`,
        state: "s".repeat(43),
        codeChallenge: "c".repeat(43),
        codeChallengeMethod: "S256",
      }),
    );

    expect(url.origin).toBe("http://localhost:3003");
    expect(url.pathname).toBe("/extension/connect");
    expect(url.searchParams.get("client_id")).toBe(STAGING_EXTENSION_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(
      `https://${STAGING_EXTENSION_ID}.chromiumapp.org/auth`,
    );
    expect(url.searchParams.get("state")).toBe("s".repeat(43));
    expect(url.searchParams.get("code_challenge")).toBe("c".repeat(43));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("creates independent 256-bit state and S256 PKCE verifier material", async () => {
    const first = await createExtensionAuthTransaction();
    const second = await createExtensionAuthTransaction();

    expect(Buffer.from(first.state, "base64url")).toHaveLength(32);
    expect(Buffer.from(first.codeVerifier, "base64url")).toHaveLength(32);
    expect(first.state).not.toBe(first.codeVerifier);
    expect(first.state).not.toBe(second.state);
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
    expect(first.codeChallenge).toBe(await deriveExtensionPkceChallenge(first.codeVerifier));
    expect(first.codeChallengeMethod).toBe("S256");
  });

  it("derives stable local and staging IDs from committed public keys only", () => {
    expect(deriveChromiumExtensionId(LOCAL_EXTENSION_MANIFEST_KEY)).toBe(
      "nkinhhgigcflmfhilmcakbkongcpkfnl",
    );
    expect(deriveChromiumExtensionId(STAGING_EXTENSION_MANIFEST_KEY)).toBe(
      "ndkfphbchhfephdodcpehdcoclojagje",
    );
    expect(LOCAL_EXTENSION_ID).not.toBe(STAGING_EXTENSION_ID);
    expect(getExtensionManifestKey("local")).toBe(LOCAL_EXTENSION_MANIFEST_KEY);
    expect(getExtensionManifestKey("staging")).toBe(STAGING_EXTENSION_MANIFEST_KEY);
    expect(getExtensionManifestKey("production")).toBeUndefined();
  });

  it("builds the website extension logout URL", () => {
    const url = new URL(
      buildExtensionLogoutUrl({
        clientId: STAGING_EXTENSION_ID,
        redirectUri: `https://${STAGING_EXTENSION_ID}.chromiumapp.org/logout`,
        state: "s".repeat(43),
      }),
    );

    expect(url.origin).toBe("http://localhost:3003");
    expect(url.pathname).toBe("/extension/logout");
    expect(url.searchParams.get("client_id")).toBe(STAGING_EXTENSION_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(
      `https://${STAGING_EXTENSION_ID}.chromiumapp.org/logout`,
    );
    expect(url.searchParams.get("state")).toBe("s".repeat(43));
  });

  it("parses a valid extension redirect", () => {
    expect(
      parseExtensionAuthRedirect(
        "https://abc.chromiumapp.org/auth?code=code-1&state=state-1",
        "state-1",
        "https://abc.chromiumapp.org/auth",
      ),
    ).toEqual({ code: "code-1", state: "state-1" });
  });

  it("rejects redirect state mismatches", () => {
    expect(() =>
      parseExtensionAuthRedirect(
        "https://abc.chromiumapp.org/auth?code=code-1&state=wrong",
        "state-1",
        "https://abc.chromiumapp.org/auth",
      ),
    ).toThrow("Invalid extension auth state");
  });

  it("rejects a callback from the wrong client or path", () => {
    expect(() =>
      parseExtensionAuthRedirect(
        "https://attacker.chromiumapp.org/auth?code=code-1&state=state-1",
        "state-1",
        "https://abc.chromiumapp.org/auth",
      ),
    ).toThrow("Invalid extension auth redirect");
    expect(() =>
      parseExtensionAuthRedirect(
        "https://abc.chromiumapp.org/logout?code=code-1&state=state-1",
        "state-1",
        "https://abc.chromiumapp.org/auth",
      ),
    ).toThrow("Invalid extension auth redirect");
    expect(() =>
      parseExtensionAuthRedirect(
        "https://abc.chromiumapp.org:443/auth?code=code-1&state=state-1",
        "state-1",
        "https://abc.chromiumapp.org/auth",
      ),
    ).toThrow("Invalid extension auth redirect");
    expect(() =>
      parseExtensionAuthRedirect(
        "https://abc.chromiumapp.org/auth?code=code-1&state=state-1#fragment",
        "state-1",
        "https://abc.chromiumapp.org/auth",
      ),
    ).toThrow("Invalid extension auth redirect");
  });

  it("validates extension logout redirects", () => {
    expect(() =>
      assertExtensionLogoutRedirect(
        "https://abc.chromiumapp.org/logout?signed_out=1&state=state-2",
        "state-2",
        "https://abc.chromiumapp.org/logout",
      ),
    ).not.toThrow();
    expect(() =>
      assertExtensionLogoutRedirect(
        "https://abc.chromiumapp.org/logout?signed_out=1&state=wrong",
        "state-2",
        "https://abc.chromiumapp.org/logout",
      ),
    ).toThrow("Invalid extension logout state");
  });

  it("validates auth runtime messages", () => {
    expect(isAuthMessage(createAuthMessage("sign-in"))).toBe(true);
    expect(isAuthMessage(createAuthMessage("get-session-fast"))).toBe(true);
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

  it("clears extension auth when the website session is signed out or belongs to another user", () => {
    expect(
      shouldClearExtensionSessionForWebsiteProbe(storedTokens, {
        status: "signed-out",
      }),
    ).toBe(true);

    expect(
      shouldClearExtensionSessionForWebsiteProbe(storedTokens, {
        status: "authenticated",
        user: {
          id: "user-2",
          email: "other@example.com",
          displayName: "Other",
          avatarUrl: null,
          plan: "free",
        },
      }),
    ).toBe(true);
  });

  it("keeps extension auth when the website session still matches or cannot be checked", () => {
    expect(
      shouldClearExtensionSessionForWebsiteProbe(storedTokens, {
        status: "authenticated",
        user: storedTokens.user,
      }),
    ).toBe(false);

    expect(
      shouldClearExtensionSessionForWebsiteProbe(storedTokens, {
        status: "unknown",
      }),
    ).toBe(false);
  });

  it("checks the long-lived website session through the extension auth endpoint", async () => {
    const request = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ user: storedTokens.user }, { status: 200 }),
    );

    await expect(fetchWebsiteSessionProbe(request)).resolves.toEqual({
      status: "authenticated",
      user: storedTokens.user,
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(new URL(request.mock.calls[0][0]).pathname).toBe("/api/extension/auth/website-session");
  });

  it("falls back to browser auth when cookie blocking hides an existing website session", async () => {
    const request = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );

    await expect(fetchWebsiteSessionProbe(request, async () => true)).resolves.toEqual({
      status: "browser-flow-required",
    });
  });

  it("keeps storage but rejects actions when refresh is temporarily unavailable", async () => {
    const clearStored = vi.fn(async () => undefined);
    const setStored = vi.fn(async () => undefined);

    await expect(
      refreshExtensionSession({
        getStored: async () => storedTokens,
        requestRefresh: async () => ({ kind: "unavailable", status: 503 }),
        resolveUser: async () => null,
        setStored,
        clearStored,
      }),
    ).rejects.toBeInstanceOf(ExtensionAuthTemporarilyUnavailableError);

    expect(clearStored).not.toHaveBeenCalled();
    expect(setStored).not.toHaveBeenCalled();
  });

  it("clears the cached session only when the refresh token is invalid", async () => {
    const clearStored = vi.fn(async () => undefined);
    const clearAccountData = vi.fn(async () => undefined);

    await expect(
      refreshExtensionSession({
        getStored: async () => storedTokens,
        requestRefresh: async () => ({ kind: "invalid" }),
        resolveUser: async () => null,
        setStored: vi.fn(async () => undefined),
        clearStored,
        clearAccountData,
      }),
    ).resolves.toBeNull();

    expect(clearStored).toHaveBeenCalledTimes(1);
    expect(clearAccountData).toHaveBeenCalledWith(storedTokens.user.id);
  });

  it("coalesces concurrent refresh requests into one operation", async () => {
    let resolveRefresh: ((result: { kind: "success"; accessToken: string }) => void) | undefined;
    const requestRefresh = vi.fn(
      () =>
        new Promise<{ kind: "success"; accessToken: string }>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const setStored = vi.fn(async () => undefined);
    const dependencies = {
      getStored: async () => storedTokens,
      requestRefresh,
      resolveUser: async () => storedTokens.user,
      setStored,
      clearStored: vi.fn(async () => undefined),
    };

    const first = refreshExtensionSession(dependencies);
    const second = refreshExtensionSession(dependencies);
    await vi.waitFor(() => expect(requestRefresh).toHaveBeenCalledTimes(1));
    resolveRefresh?.({ kind: "success", accessToken: "access-2" });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { ...storedTokens, accessToken: "access-2" },
      { ...storedTokens, accessToken: "access-2" },
    ]);
    expect(setStored).toHaveBeenCalledTimes(1);
  });

  it("does not restore a session that was cleared while refresh was in flight", async () => {
    let storedReadCount = 0;
    const setStored = vi.fn(async () => undefined);

    await expect(
      refreshExtensionSession({
        getStored: async () => {
          storedReadCount += 1;
          return storedReadCount === 1 ? storedTokens : null;
        },
        requestRefresh: async () => ({ kind: "success", accessToken: "access-2" }),
        resolveUser: async () => storedTokens.user,
        setStored,
        clearStored: vi.fn(async () => undefined),
      }),
    ).resolves.toBeNull();

    expect(setStored).not.toHaveBeenCalled();
  });

  it("does not restore a session changed while refreshed user data was loading", async () => {
    let storedReadCount = 0;
    const replacement = {
      ...storedTokens,
      refreshToken: "replacement-refresh",
      user: { ...storedTokens.user, id: "user-2" },
    };
    const setStored = vi.fn(async () => undefined);

    await expect(
      refreshExtensionSession({
        getStored: async () => {
          storedReadCount += 1;
          return storedReadCount < 3 ? storedTokens : replacement;
        },
        requestRefresh: async () => ({ kind: "success", accessToken: "access-2" }),
        resolveUser: async () => storedTokens.user,
        setStored,
        clearStored: vi.fn(async () => undefined),
      }),
    ).resolves.toBe(replacement);

    expect(setStored).not.toHaveBeenCalled();
  });

  it("does not restore a session that was cleared during user validation", async () => {
    let storedReadCount = 0;
    const setStored = vi.fn(async () => undefined);

    await expect(
      getCurrentExtensionSession({
        getStored: async () => {
          storedReadCount += 1;
          return storedReadCount === 1 ? storedTokens : null;
        },
        resolveUser: async () => storedTokens.user,
        setStored,
        refresh: async () => storedTokens,
      }),
    ).resolves.toBeNull();

    expect(setStored).not.toHaveBeenCalled();
  });

  it("does not clear a replacement session after an older request finishes", async () => {
    const replacement = {
      ...storedTokens,
      refreshToken: "replacement-refresh",
      user: { ...storedTokens.user, id: "user-2" },
    };
    const clearStored = vi.fn(async () => undefined);

    await expect(
      clearExtensionSessionIfCurrent(storedTokens.refreshToken, {
        getStored: async () => replacement,
        clearStored,
      }),
    ).resolves.toBe(false);

    expect(clearStored).not.toHaveBeenCalled();
  });

  it("clears account-scoped data together with the matching session", async () => {
    const clearStored = vi.fn(async () => undefined);
    const clearAccountData = vi.fn(async () => undefined);

    await expect(
      clearExtensionSessionIfCurrent(storedTokens.refreshToken, {
        getStored: async () => storedTokens,
        clearStored,
        clearAccountData,
      }),
    ).resolves.toBe(true);

    expect(clearStored).toHaveBeenCalledTimes(1);
    expect(clearAccountData).toHaveBeenCalledWith(storedTokens.user.id);
  });

  it("does not mint an extension session during startup when none is stored", async () => {
    const signInSilently = vi.fn(async () => storedTokens);

    await expect(
      reconcileExtensionSessionAgainstWebsite(
        { adoptIfMissing: false },
        {
          getStored: async () => null,
          ensureMatches: async () => "matches",
          signInSilently,
          getCurrent: async () => storedTokens,
          revokeRefreshToken: async () => undefined,
        },
      ),
    ).resolves.toBeNull();

    expect(signInSilently).not.toHaveBeenCalled();
  });

  it("clears extension auth only for configured website refresh cookie removals", () => {
    expect(
      shouldClearExtensionSessionForWebsiteCookieChange({
        removed: true,
        cause: "explicit",
        cookie: {
          name: "anidachi_refresh_token",
          domain: "localhost",
        },
      }),
    ).toBe(true);

    expect(
      shouldClearExtensionSessionForWebsiteCookieChange({
        removed: true,
        cause: "overwrite",
        cookie: {
          name: "anidachi_refresh_token",
          domain: "localhost",
        },
      }),
    ).toBe(false);

    expect(
      shouldClearExtensionSessionForWebsiteCookieChange({
        removed: true,
        cause: "explicit",
        cookie: {
          name: "other_cookie",
          domain: "localhost",
        },
      }),
    ).toBe(false);
  });

  it("syncs extension auth when the configured website refresh cookie is set", () => {
    expect(
      shouldSyncExtensionSessionForWebsiteCookieChange({
        removed: false,
        cause: "explicit",
        cookie: {
          name: "anidachi_refresh_token",
          domain: "localhost",
        },
      }),
    ).toBe(true);

    expect(
      shouldSyncExtensionSessionForWebsiteCookieChange({
        removed: false,
        cause: "explicit",
        cookie: {
          name: "anidachi_refresh_token",
          domain: "example.com",
        },
      }),
    ).toBe(false);
  });

  it("keeps the WXT auth key and raw storage key aligned", () => {
    expect(AUTH_TOKENS_STORAGE_KEY).toBe("authTokens");
    expect(AUTH_TOKENS_KEY).toBe("local:authTokens");
  });

  it("returns cached tokens for the fast session path while refreshing in the background", async () => {
    const refresh = vi.fn().mockRejectedValue(new Error("offline"));

    const tokens = await getFastSessionAndRefreshInBackground({
      getCached: async () => storedTokens,
      refresh,
    });

    expect(tokens).toBe(storedTokens);
    expect(refresh).toHaveBeenCalledTimes(1);

    await Promise.resolve();
    await Promise.resolve();
  });

  it("clears extension tokens only after attempting website logout", async () => {
    const events: string[] = [];

    await runWebsiteSignOutSequence({
      getStoredTokens: async () => {
        events.push("read-stored");
        return storedTokens;
      },
      flushBeforeSignOut: vi.fn(async (tokens) => {
        expect(tokens).toBe(storedTokens);
        events.push("flush-history");
      }),
      revokeRefreshToken: vi.fn(async () => {
        events.push("revoke");
      }),
      attemptWebsiteLogout: vi.fn(async () => {
        events.push("logout-flow");
      }),
      clearTokens: vi.fn(async (expectedRefreshToken) => {
        expect(expectedRefreshToken).toBe(storedTokens.refreshToken);
        events.push("clear");
      }),
    });

    expect(events).toEqual(["read-stored", "flush-history", "revoke", "logout-flow", "clear"]);
  });

  it("does not let a failed pre-sign-out history flush block token clearing", async () => {
    const events: string[] = [];
    await runWebsiteSignOutSequence({
      getStoredTokens: async () => storedTokens,
      flushBeforeSignOut: async () => {
        events.push("flush-history");
        throw new Error("offline");
      },
      revokeRefreshToken: async () => { events.push("revoke"); },
      attemptWebsiteLogout: async () => { events.push("logout-flow"); },
      clearTokens: async () => { events.push("clear"); },
    });
    expect(events).toEqual(["flush-history", "revoke", "logout-flow", "clear"]);
  });

  it("clears extension tokens even when website logout fails", async () => {
    const events: string[] = [];

    await expect(
      runWebsiteSignOutSequence({
        getStoredTokens: async () => storedTokens,
        revokeRefreshToken: vi.fn(async () => {
          events.push("revoke");
        }),
        attemptWebsiteLogout: vi.fn(async () => {
          events.push("logout-flow");
          throw new Error("Invalid extension logout state");
        }),
        clearTokens: vi.fn(async () => {
          events.push("clear");
        }),
      }),
    ).rejects.toThrow("Invalid extension logout state");

    expect(events).toEqual(["revoke", "logout-flow", "clear"]);
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
        plan: "free",
      },
    });
  });

  it("rejects malformed users", () => {
    expect(normalizeAuthenticatedUser({ id: "user-1", plan: "free" })).toBeNull();
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
