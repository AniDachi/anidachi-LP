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
  handleWebsiteAuthCookieChange,
  isAuthMessage,
  normalizeExtensionRefreshResponse,
  parseExtensionAuthRedirect,
  reconcileExtensionSessionAgainstWebsite,
  refreshExtensionSession,
  runWebsiteSignOutSequence,
  signInWithWebsite,
  signInWithWebsiteSilently,
  shouldClearExtensionSessionForWebsiteProbe,
  shouldClearExtensionSessionForWebsiteCookieChange,
  shouldSyncExtensionSessionForWebsiteCookieChange,
  type WebsiteSessionProbe,
  type WebsiteSessionReconciliationDependencies,
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
  createAuthSessionStorageAuthority,
  type ExtensionAuthTokens,
  isSameExtensionAuthSession,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function websiteReconciliationHarness({
  initial,
  probe,
  websiteTokens = null,
}: {
  initial: ExtensionAuthTokens | null;
  probe: WebsiteSessionProbe;
  websiteTokens?: ExtensionAuthTokens | null;
}) {
  let current = initial;
  const revokeRefreshToken = vi.fn(async (_refreshToken: string) => undefined);
  const dependencies: WebsiteSessionReconciliationDependencies = {
    getStored: vi.fn(async () => current),
    ensureMatches: vi.fn(async (stored) => {
      if (probe.status === "browser-flow-required") return "browser-flow-required";
      if (!shouldClearExtensionSessionForWebsiteProbe(stored, probe)) return "matches";

      await revokeRefreshToken(stored.refreshToken);
      if (current && isSameExtensionAuthSession(stored, current)) {
        current = null;
        return "cleared";
      }
      return "matches";
    }),
    signInSilently: vi.fn(async () => {
      if (!websiteTokens) return null;
      current = websiteTokens;
      return websiteTokens;
    }),
    getCurrent: vi.fn(async () => current),
    revokeRefreshToken,
  };

  return {
    dependencies,
    revokeRefreshToken,
    current: () => current,
    clearExactFamily: (expected: ExtensionAuthTokens) => {
      if (current && isSameExtensionAuthSession(expected, current)) current = null;
    },
    install: (tokens: ExtensionAuthTokens) => {
      current = tokens;
    },
  };
}

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
    const commitIfCurrent = vi.fn();

    await expect(
      refreshExtensionSession({
        getStored: async () => storedTokens,
        requestRefresh: async () => ({ kind: "unavailable", status: 503 }),
        resolveUser: async () => null,
        commitIfCurrent,
      }),
    ).rejects.toBeInstanceOf(ExtensionAuthTemporarilyUnavailableError);

    expect(commitIfCurrent).not.toHaveBeenCalled();
  });

  it("clears the cached session only when the refresh token is invalid", async () => {
    const commitIfCurrent = vi.fn(async () => ({
      committed: true,
      current: null,
      previous: storedTokens,
    }));
    const clearAccountData = vi.fn(async () => undefined);

    await expect(
      refreshExtensionSession({
        getStored: async () => storedTokens,
        requestRefresh: async () => ({ kind: "invalid" }),
        resolveUser: async () => null,
        commitIfCurrent,
        clearAccountData,
      }),
    ).resolves.toBeNull();

    expect(commitIfCurrent).toHaveBeenCalledWith(storedTokens, null);
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
    const commitIfCurrent = vi.fn(async (_expected, replacement) => ({
      committed: true,
      current: replacement,
      previous: storedTokens,
    }));
    const dependencies = {
      getStored: async () => storedTokens,
      requestRefresh,
      resolveUser: async () => storedTokens.user,
      commitIfCurrent,
    };

    const first = refreshExtensionSession(dependencies);
    const second = refreshExtensionSession(dependencies);
    await vi.waitFor(() => expect(requestRefresh).toHaveBeenCalledTimes(1));
    resolveRefresh?.({ kind: "success", accessToken: "access-2" });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { ...storedTokens, accessToken: "access-2" },
      { ...storedTokens, accessToken: "access-2" },
    ]);
    expect(commitIfCurrent).toHaveBeenCalledTimes(1);
  });

  it("does not restore a session that was cleared while refresh was in flight", async () => {
    const commitIfCurrent = vi.fn(async () => ({
      committed: false,
      current: null,
      previous: null,
    }));

    await expect(
      refreshExtensionSession({
        getStored: async () => storedTokens,
        requestRefresh: async () => ({ kind: "success", accessToken: "access-2" }),
        resolveUser: async () => storedTokens.user,
        commitIfCurrent,
      }),
    ).resolves.toBeNull();

    expect(commitIfCurrent).toHaveBeenCalledTimes(1);
  });

  it("does not restore a session changed while refreshed user data was loading", async () => {
    const replacement = {
      ...storedTokens,
      refreshToken: "replacement-refresh",
      user: { ...storedTokens.user, id: "user-2" },
    };
    const commitIfCurrent = vi.fn(async () => ({
      committed: false,
      current: replacement,
      previous: replacement,
    }));

    await expect(
      refreshExtensionSession({
        getStored: async () => storedTokens,
        requestRefresh: async () => ({ kind: "success", accessToken: "access-2" }),
        resolveUser: async () => storedTokens.user,
        commitIfCurrent,
      }),
    ).resolves.toBe(replacement);

    expect(commitIfCurrent).toHaveBeenCalledTimes(1);
  });

  it("uses both predecessor token and account for refresh compare-and-set", async () => {
    const replacement = {
      ...storedTokens,
      user: { ...storedTokens.user, id: "user-2" },
    };
    const commitIfCurrent = vi.fn(async () => ({
      committed: false,
      current: replacement,
      previous: replacement,
    }));

    await expect(
      refreshExtensionSession({
        getStored: async () => storedTokens,
        requestRefresh: async () => ({ kind: "invalid" }),
        resolveUser: async () => storedTokens.user,
        commitIfCurrent,
      }),
    ).resolves.toBe(replacement);

    expect(commitIfCurrent).toHaveBeenCalledWith(storedTokens, null);
    expect(isSameExtensionAuthSession(storedTokens, replacement)).toBe(false);
    expect(isSameExtensionAuthSession(storedTokens, { ...storedTokens })).toBe(true);
  });

  it("serializes a newer sign-in behind an in-flight conditional refresh persist", async () => {
    const refreshed = {
      ...storedTokens,
      accessToken: "old-account-access-2",
      refreshToken: "old-account-refresh-2",
    };
    const replacement = {
      ...storedTokens,
      accessToken: "new-account-access",
      refreshToken: "new-account-refresh",
      user: { ...storedTokens.user, id: "user-2" },
    };
    let current: ExtensionAuthTokens | null = storedTokens;
    let releaseOldPersist: (() => void) | undefined;
    let markOldPersistStarted: (() => void) | undefined;
    const oldPersistStarted = new Promise<void>((resolve) => {
      markOldPersistStarted = resolve;
    });
    const oldPersistGate = new Promise<void>((resolve) => {
      releaseOldPersist = resolve;
    });
    const authority = createAuthSessionStorageAuthority({
      get: async () => current,
      set: async (tokens) => {
        if (tokens.refreshToken === refreshed.refreshToken) {
          markOldPersistStarted?.();
          await oldPersistGate;
        }
        current = tokens;
      },
      remove: async () => {
        current = null;
      },
    });

    const oldCommit = authority.commitIfCurrent(storedTokens, refreshed);
    await oldPersistStarted;
    const newerSignIn = authority.replace(replacement);
    releaseOldPersist?.();
    await Promise.all([oldCommit, newerSignIn]);

    expect(current).toEqual(replacement);
  });

  it("serializes a newer sign-in behind an in-flight conditional invalid clear", async () => {
    const replacement = {
      ...storedTokens,
      accessToken: "new-account-access",
      refreshToken: "new-account-refresh",
      user: { ...storedTokens.user, id: "user-2" },
    };
    let current: ExtensionAuthTokens | null = storedTokens;
    let releaseOldClear: (() => void) | undefined;
    let markOldClearStarted: (() => void) | undefined;
    const oldClearStarted = new Promise<void>((resolve) => {
      markOldClearStarted = resolve;
    });
    const oldClearGate = new Promise<void>((resolve) => {
      releaseOldClear = resolve;
    });
    const authority = createAuthSessionStorageAuthority({
      get: async () => current,
      set: async (tokens) => {
        current = tokens;
      },
      remove: async () => {
        markOldClearStarted?.();
        await oldClearGate;
        current = null;
      },
    });

    const oldClear = authority.commitIfCurrent(storedTokens, null);
    await oldClearStarted;
    const newerSignIn = authority.replace(replacement);
    releaseOldClear?.();
    await Promise.all([oldClear, newerSignIn]);

    expect(current).toEqual(replacement);
  });

  it("serializes a replacement account behind exact-family sign-out side effects and preserves the replacement", async () => {
    const replacement = {
      ...storedTokens,
      accessToken: "replacement-access",
      refreshToken: "replacement-refresh",
      user: { ...storedTokens.user, id: "user-2" },
    };
    let current: ExtensionAuthTokens | null = storedTokens;
    const signOutStarted = deferred<void>();
    const releaseSignOut = deferred<void>();
    const events: string[] = [];
    const authority = createAuthSessionStorageAuthority({
      get: async () => current,
      set: async (tokens) => {
        current = tokens;
        events.push(`set:${tokens.user.id}`);
      },
      remove: async () => {
        current = null;
        events.push("remove:user-1");
      },
    });
    const clearIfCurrentAfter = (
      authority as typeof authority & {
        clearIfCurrentAfter?: (
          expected: ExtensionAuthTokens,
          beforeClear: (tokens: ExtensionAuthTokens) => Promise<void>,
        ) => Promise<unknown>;
      }
    ).clearIfCurrentAfter;

    expect(clearIfCurrentAfter).toBeTypeOf("function");
    if (!clearIfCurrentAfter) return;

    const signOut = clearIfCurrentAfter(storedTokens, async (tokens) => {
      expect(tokens).toBe(storedTokens);
      events.push("sign-out:user-1");
      signOutStarted.resolve();
      await releaseSignOut.promise;
    });
    await signOutStarted.promise;
    const replacementSignIn = authority.replace(replacement);
    await Promise.resolve();
    expect(current).toBe(storedTokens);

    releaseSignOut.resolve();
    await Promise.all([signOut, replacementSignIn]);

    expect(current).toEqual(replacement);
    expect(events).toEqual(["sign-out:user-1", "remove:user-1", "set:user-2"]);

    const staleSignOutSideEffects = vi.fn(async () => undefined);
    await expect(
      authority.clearIfCurrentAfter(storedTokens, staleSignOutSideEffects),
    ).resolves.toMatchObject({ committed: false, current: replacement });
    expect(staleSignOutSideEffects).not.toHaveBeenCalled();
    expect(current).toEqual(replacement);
  });

  it("does not restore a session that was cleared during user validation", async () => {
    const commitIfCurrent = vi.fn(async () => ({
      committed: false,
      current: null,
      previous: null,
    }));

    await expect(
      getCurrentExtensionSession({
        getStored: async () => storedTokens,
        resolveUser: async () => storedTokens.user,
        commitIfCurrent,
        refresh: async () => storedTokens,
      }),
    ).resolves.toBeNull();

    expect(commitIfCurrent).toHaveBeenCalledTimes(1);
  });

  it("tries one refresh and then silent website adoption for an invalid family", async () => {
    const resolveUser = vi.fn(async () => null);
    const refresh = vi.fn(async () => null);
    const adoptSilently = vi.fn(async () => ({
      ...storedTokens,
      accessToken: "adopted-access",
      refreshToken: "adopted-refresh",
    }));

    await expect(
      getCurrentExtensionSession({
        getStored: async () => storedTokens,
        resolveUser,
        commitIfCurrent: vi.fn(),
        refresh,
        adoptSilently,
      }),
    ).resolves.toEqual({
      ...storedTokens,
      accessToken: "adopted-access",
      refreshToken: "adopted-refresh",
    });

    expect(resolveUser).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(adoptSilently).toHaveBeenCalledTimes(1);
  });

  it("performs one refresh and one session-resolution retry without a loop", async () => {
    const resolveUser = vi
      .fn<(accessToken: string) => Promise<typeof storedTokens.user | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedTokens.user);
    const requestRefresh = vi.fn(async () => ({
      kind: "success" as const,
      accessToken: "access-2",
      refreshToken: "refresh-2",
    }));
    const commitIfCurrent = vi.fn(async (_expected, replacement) => ({
      committed: true,
      current: replacement,
      previous: storedTokens,
    }));

    const result = await getCurrentExtensionSession({
      getStored: async () => storedTokens,
      resolveUser,
      commitIfCurrent,
      refresh: () =>
        refreshExtensionSession({
          getStored: async () => storedTokens,
          requestRefresh,
          resolveUser,
          commitIfCurrent,
        }),
      adoptSilently: vi.fn(async () => null),
    });

    expect(result).toEqual({
      ...storedTokens,
      accessToken: "access-2",
      refreshToken: "refresh-2",
    });
    expect(resolveUser).toHaveBeenCalledTimes(2);
    expect(requestRefresh).toHaveBeenCalledTimes(1);
    expect(commitIfCurrent).toHaveBeenCalledTimes(1);
  });

  it("keeps interactive browser auth exclusive to explicit sign-in", async () => {
    const launchWebAuthFlow = vi.fn(async ({ interactive }: { interactive: boolean }) => {
      expect(typeof interactive).toBe("boolean");
      return undefined;
    });
    vi.stubGlobal("chrome", {
      identity: {
        getRedirectURL: () => `https://${STAGING_EXTENSION_ID}.chromiumapp.org/auth`,
        launchWebAuthFlow,
      },
      runtime: { id: STAGING_EXTENSION_ID },
    });

    try {
      await expect(signInWithWebsiteSilently()).resolves.toBeNull();
      await expect(signInWithWebsite()).rejects.toThrow("cancelled");
      expect(launchWebAuthFlow.mock.calls.map(([input]) => input.interactive)).toEqual([
        false,
        true,
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not clear a replacement session after an older request finishes", async () => {
    const replacement = {
      ...storedTokens,
      refreshToken: "replacement-refresh",
      user: { ...storedTokens.user, id: "user-2" },
    };
    const clearIfRefreshToken = vi.fn(async () => ({
      committed: false,
      current: replacement,
      previous: replacement,
    }));

    await expect(
      clearExtensionSessionIfCurrent(storedTokens.refreshToken, {
        clearIfRefreshToken,
      }),
    ).resolves.toBe(false);

    expect(clearIfRefreshToken).toHaveBeenCalledWith(storedTokens.refreshToken);
  });

  it("clears account-scoped data together with the matching session", async () => {
    const clearIfRefreshToken = vi.fn(async () => ({
      committed: true,
      current: null,
      previous: storedTokens,
    }));
    const clearAccountData = vi.fn(async () => undefined);

    await expect(
      clearExtensionSessionIfCurrent(storedTokens.refreshToken, {
        clearIfRefreshToken,
        clearAccountData,
      }),
    ).resolves.toBe(true);

    expect(clearIfRefreshToken).toHaveBeenCalledTimes(1);
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

  it("runs a trailing logout reconciliation when removal arrives during an authenticated probe", async () => {
    const firstProbe = deferred<void>();
    const logoutProbe = deferred<void>();
    let current: ExtensionAuthTokens | null = storedTokens;
    let probeCalls = 0;
    let activeProbes = 0;
    let maxActiveProbes = 0;
    const revokeRefreshToken = vi.fn(async (_refreshToken: string) => undefined);
    const dependencies: WebsiteSessionReconciliationDependencies = {
      getStored: vi.fn(async () => current),
      ensureMatches: vi.fn(async (stored) => {
        probeCalls += 1;
        activeProbes += 1;
        maxActiveProbes = Math.max(maxActiveProbes, activeProbes);
        try {
          if (probeCalls === 1) {
            await firstProbe.promise;
            return "matches";
          }

          await logoutProbe.promise;
          await revokeRefreshToken(stored.refreshToken);
          if (current && isSameExtensionAuthSession(stored, current)) current = null;
          return "cleared";
        } finally {
          activeProbes -= 1;
        }
      }),
      signInSilently: vi.fn(async () => null),
      getCurrent: vi.fn(async () => current),
      revokeRefreshToken,
    };

    const initial = reconcileExtensionSessionAgainstWebsite(
      { adoptIfMissing: false },
      dependencies,
    );
    await vi.waitFor(() => expect(probeCalls).toBe(1));

    let removalSettled = false;
    const removal = handleWebsiteAuthCookieChange(
      {
        removed: true,
        cause: "explicit",
        cookie: { name: "anidachi_refresh_token", domain: "localhost" },
      },
      dependencies,
    ).then(() => {
      removalSettled = true;
    });
    await Promise.resolve();
    expect(removalSettled).toBe(false);
    expect(probeCalls).toBe(1);

    firstProbe.resolve();
    await expect(initial).resolves.toEqual(storedTokens);
    await vi.waitFor(() => expect(probeCalls).toBe(2));
    expect(removalSettled).toBe(false);
    expect(maxActiveProbes).toBe(1);

    logoutProbe.resolve();
    await removal;
    expect(current).toBeNull();
    expect(revokeRefreshToken).toHaveBeenCalledOnce();
    expect(revokeRefreshToken).toHaveBeenCalledWith(storedTokens.refreshToken);
    expect(probeCalls).toBe(2);
    expect(maxActiveProbes).toBe(1);
  });

  it("OR-merges overlapping cookie-set adoption into one trailing startup pass", async () => {
    const startupRead = deferred<void>();
    const adoption = deferred<void>();
    const adopted = {
      ...storedTokens,
      accessToken: "adopted-access",
      refreshToken: "adopted-refresh",
    };
    let current: ExtensionAuthTokens | null = null;
    let storageReads = 0;
    let activeReads = 0;
    let maxActiveReads = 0;
    const dependencies: WebsiteSessionReconciliationDependencies = {
      getStored: vi.fn(async () => {
        storageReads += 1;
        activeReads += 1;
        maxActiveReads = Math.max(maxActiveReads, activeReads);
        try {
          if (storageReads === 1) await startupRead.promise;
          return current;
        } finally {
          activeReads -= 1;
        }
      }),
      ensureMatches: vi.fn(async (_stored: ExtensionAuthTokens) => "matches" as const),
      signInSilently: vi.fn(async () => {
        await adoption.promise;
        current = adopted;
        return adopted;
      }),
      getCurrent: vi.fn(async () => current),
      revokeRefreshToken: vi.fn(async (_refreshToken: string) => undefined),
    };

    const startup = reconcileExtensionSessionAgainstWebsite(
      { adoptIfMissing: false },
      dependencies,
    );
    await vi.waitFor(() => expect(storageReads).toBe(1));

    let firstCookieSettled = false;
    let secondCookieSettled = false;
    let laterStartupSettled = false;
    const cookieChange = {
      removed: false,
      cause: "explicit",
      cookie: { name: "anidachi_refresh_token", domain: "localhost" },
    };
    const firstCookie = handleWebsiteAuthCookieChange(cookieChange, dependencies).then(() => {
      firstCookieSettled = true;
    });
    const laterStartup = reconcileExtensionSessionAgainstWebsite(
      { adoptIfMissing: false },
      dependencies,
    ).then((tokens) => {
      laterStartupSettled = true;
      return tokens;
    });
    const secondCookie = handleWebsiteAuthCookieChange(cookieChange, dependencies).then(() => {
      secondCookieSettled = true;
    });

    startupRead.resolve();
    await expect(startup).resolves.toBeNull();
    await vi.waitFor(() => expect(storageReads).toBe(2));
    expect(firstCookieSettled).toBe(false);
    expect(secondCookieSettled).toBe(false);
    expect(laterStartupSettled).toBe(false);
    expect(dependencies.signInSilently).toHaveBeenCalledOnce();
    expect(maxActiveReads).toBe(1);

    adoption.resolve();
    await Promise.all([firstCookie, secondCookie]);
    await expect(laterStartup).resolves.toEqual(adopted);
    expect(current).toEqual(adopted);
    expect(storageReads).toBe(2);
    expect(maxActiveReads).toBe(1);
  });

  it("queues one further pass during a trailing pass and forwards its error", async () => {
    const probes = [deferred<void>(), deferred<void>(), deferred<void>()];
    const trailingFailure = new Error("trailing reconciliation failed");
    let probeCalls = 0;
    let activeProbes = 0;
    let maxActiveProbes = 0;
    const dependencies: WebsiteSessionReconciliationDependencies = {
      getStored: vi.fn(async () => storedTokens),
      ensureMatches: vi.fn(async (_stored: ExtensionAuthTokens) => {
        const callIndex = probeCalls;
        probeCalls += 1;
        activeProbes += 1;
        maxActiveProbes = Math.max(maxActiveProbes, activeProbes);
        try {
          await probes[callIndex].promise;
          if (callIndex === 2) throw trailingFailure;
          return "matches" as const;
        } finally {
          activeProbes -= 1;
        }
      }),
      signInSilently: vi.fn(async () => null),
      getCurrent: vi.fn(async () => storedTokens),
      revokeRefreshToken: vi.fn(async (_refreshToken: string) => undefined),
    };

    const first = reconcileExtensionSessionAgainstWebsite({}, dependencies);
    await vi.waitFor(() => expect(probeCalls).toBe(1));
    const secondA = reconcileExtensionSessionAgainstWebsite({}, dependencies);
    const secondB = reconcileExtensionSessionAgainstWebsite(
      { adoptIfMissing: false },
      dependencies,
    );

    probes[0].resolve();
    await expect(first).resolves.toEqual(storedTokens);
    await vi.waitFor(() => expect(probeCalls).toBe(2));
    const thirdA = reconcileExtensionSessionAgainstWebsite({}, dependencies);
    const thirdB = reconcileExtensionSessionAgainstWebsite({}, dependencies);

    probes[1].resolve();
    await expect(Promise.all([secondA, secondB])).resolves.toEqual([
      storedTokens,
      storedTokens,
    ]);
    await vi.waitFor(() => expect(probeCalls).toBe(3));

    probes[2].resolve();
    await expect(thirdA).rejects.toBe(trailingFailure);
    await expect(thirdB).rejects.toBe(trailingFailure);
    expect(probeCalls).toBe(3);
    expect(maxActiveProbes).toBe(1);
  });

  it("keeps replacement B when delayed account-A cookie removal observes website B", async () => {
    const replacement = {
      ...storedTokens,
      accessToken: "access-b",
      refreshToken: "refresh-b",
      user: { ...storedTokens.user, id: "user-b", email: "b@example.com" },
    };
    const harness = websiteReconciliationHarness({
      initial: storedTokens,
      probe: { status: "authenticated", user: replacement.user },
      websiteTokens: replacement,
    });
    harness.clearExactFamily(storedTokens);
    expect(harness.current()).toBeNull();
    harness.install(replacement);

    await expect(
      handleWebsiteAuthCookieChange(
        {
          removed: true,
          cause: "explicit",
          cookie: { name: "anidachi_refresh_token", domain: "localhost" },
        },
        harness.dependencies,
      ),
    ).resolves.toBeUndefined();

    expect(harness.dependencies.ensureMatches).toHaveBeenCalledWith(replacement);
    expect(harness.current()).toEqual(replacement);
    expect(harness.revokeRefreshToken).not.toHaveBeenCalled();
  });

  it("reconciles a real external website logout against only the exact current family", async () => {
    const harness = websiteReconciliationHarness({
      initial: storedTokens,
      probe: { status: "signed-out" },
    });

    await expect(
      handleWebsiteAuthCookieChange(
        {
          removed: true,
          cause: "explicit",
          cookie: { name: "anidachi_refresh_token", domain: "localhost" },
        },
        harness.dependencies,
      ),
    ).resolves.toBeUndefined();

    expect(harness.revokeRefreshToken).toHaveBeenCalledOnce();
    expect(harness.revokeRefreshToken).toHaveBeenCalledWith(storedTokens.refreshToken);
    expect(harness.current()).toBeNull();
  });

  it("reconciles a configured cookie-set event and adopts the website session", async () => {
    const websiteTokens = {
      ...storedTokens,
      accessToken: "website-access",
      refreshToken: "website-refresh",
    };
    const harness = websiteReconciliationHarness({
      initial: null,
      probe: { status: "authenticated", user: websiteTokens.user },
      websiteTokens,
    });

    await expect(
      handleWebsiteAuthCookieChange(
        {
          removed: false,
          cause: "explicit",
          cookie: { name: "anidachi_refresh_token", domain: "localhost" },
        },
        harness.dependencies,
      ),
    ).resolves.toBeUndefined();

    expect(harness.dependencies.signInSilently).toHaveBeenCalledOnce();
    expect(harness.current()).toEqual(websiteTokens);
  });

  it.each([
    ["unknown/network", { status: "unknown" } as const],
    ["browser-flow-required", { status: "browser-flow-required" } as const],
  ])("does not blindly clear for a %s website probe", async (_label, probe) => {
    const harness = websiteReconciliationHarness({ initial: storedTokens, probe });

    await expect(
      handleWebsiteAuthCookieChange(
        {
          removed: true,
          cause: "explicit",
          cookie: { name: "anidachi_refresh_token", domain: "localhost" },
        },
        harness.dependencies,
      ),
    ).resolves.toBeUndefined();

    expect(harness.dependencies.ensureMatches).toHaveBeenCalledWith(storedTokens);
    expect(harness.current()).toEqual(storedTokens);
    expect(harness.revokeRefreshToken).not.toHaveBeenCalled();
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
