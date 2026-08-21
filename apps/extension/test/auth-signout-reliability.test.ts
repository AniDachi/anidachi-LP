import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  events: [] as string[],
  storage: new Map<string, unknown>(),
  flushWatchHistory: vi.fn(async () => {
    harness.events.push("flush-history");
  }),
  recordDiagnosticEvent: vi.fn(),
  revokeRefreshToken: vi.fn(async () => {
    harness.events.push("revoke-refresh");
    return new Response(null, { status: 200 });
  }),
  websiteLogout: vi.fn(async () => {
    harness.events.push("website-logout");
    return undefined;
  }),
}));

vi.mock("wxt/utils/storage", () => ({
  storage: {
    getItem: vi.fn(async (key: string) => harness.storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: unknown) => {
      harness.events.push(`set:${key}`);
      harness.storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      harness.events.push(`remove:${key}`);
      harness.storage.delete(key);
    }),
  },
}));

vi.mock("../src/watch-history-client", () => ({
  bestEffortFlushWatchHistoryBeforeSignOut: harness.flushWatchHistory,
}));

vi.mock("../src/diagnostic-log", () => ({
  recordDiagnosticEvent: harness.recordDiagnosticEvent,
}));

import { signOutWithWebsite } from "../src/auth-client";
import {
  AUTH_TOKENS_KEY,
  getStoredAuthTokens,
  setStoredAuthTokens,
  type ExtensionAuthTokens,
} from "../src/auth-tokens";
import { accountInboxCacheKeyForUser } from "../src/account-inbox-cache";
import { socialSnapshotCacheKeyForUser } from "../src/social-snapshot-cache";

const accountA = sessionFor("user-a");
const accountB = sessionFor("user-b");

beforeEach(() => {
  harness.events.length = 0;
  harness.storage.clear();
  harness.flushWatchHistory.mockClear();
  harness.recordDiagnosticEvent.mockClear();
  harness.revokeRefreshToken.mockReset();
  harness.revokeRefreshToken.mockImplementation(async () => {
    harness.events.push("revoke-refresh");
    return new Response(null, { status: 200 });
  });
  harness.websiteLogout.mockReset();
  harness.websiteLogout.mockImplementation(async () => {
    harness.events.push("website-logout");
    return undefined;
  });
  harness.flushWatchHistory.mockReset();
  harness.flushWatchHistory.mockImplementation(async () => {
    harness.events.push("flush-history");
  });

  vi.stubGlobal("fetch", harness.revokeRefreshToken);
  vi.stubGlobal("chrome", {
    runtime: { id: "ndkfphbchhfephdodcpehdcoclojagje" },
    identity: {
      getRedirectURL: () =>
        "https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/logout",
      launchWebAuthFlow: harness.websiteLogout,
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("exact-family sign-out reliability", () => {
  it("continues every sign-out side effect after matched room cleanup rejects and preserves queued account B", async () => {
    await setStoredAuthTokens(accountA);
    harness.storage.set(socialSnapshotCacheKeyForUser(accountA.user.id), { owner: "a" });
    harness.storage.set(accountInboxCacheKeyForUser(accountA.user.id), { owner: "a" });
    harness.events.length = 0;

    const callbackStarted = deferred<void>();
    const callbackFailure = deferred<void>();
    const signOut = signOutWithWebsite(accountA, async (matchedSession) => {
      expect(matchedSession).toEqual(accountA);
      harness.events.push("room-authority-clear");
      callbackStarted.resolve();
      await callbackFailure.promise;
    });

    await callbackStarted.promise;
    const replacement = setStoredAuthTokens(accountB);
    callbackFailure.reject(new Error("unique room storage failure 8c7f"));

    await expect(signOut).resolves.toBe(true);
    await replacement;

    expect(await getStoredAuthTokens()).toEqual(accountB);
    expect(harness.storage.has(socialSnapshotCacheKeyForUser(accountA.user.id))).toBe(false);
    expect(harness.storage.has(accountInboxCacheKeyForUser(accountA.user.id))).toBe(false);
    expect(harness.flushWatchHistory).toHaveBeenCalledWith(accountA);
    expect(harness.recordDiagnosticEvent).toHaveBeenCalledWith(
      "auth.logout",
      "matched-session cleanup failed",
      undefined,
      "warn",
    );
    expect(JSON.stringify(harness.recordDiagnosticEvent.mock.calls)).not.toContain(
      "unique room storage failure 8c7f",
    );

    expect(harness.events).toContain("revoke-refresh");
    expect(harness.events).toContain("website-logout");
    expectBefore("room-authority-clear", "flush-history");
    expectBefore("flush-history", "revoke-refresh");
    expectBefore("revoke-refresh", "website-logout");
    expectBefore("website-logout", `remove:${AUTH_TOKENS_KEY}`);
    expectBefore(`remove:${AUTH_TOKENS_KEY}`, `set:${AUTH_TOKENS_KEY}`);
    expectBefore(`remove:${AUTH_TOKENS_KEY}`, `remove:${socialSnapshotCacheKeyForUser(accountA.user.id)}`);
    expectBefore(`remove:${AUTH_TOKENS_KEY}`, `remove:${accountInboxCacheKeyForUser(accountA.user.id)}`);
  });

  it("runs neither the callback nor sign-out side effects for a stale non-matching family", async () => {
    await setStoredAuthTokens(accountB);
    harness.storage.set(socialSnapshotCacheKeyForUser(accountB.user.id), { owner: "b" });
    harness.storage.set(accountInboxCacheKeyForUser(accountB.user.id), { owner: "b" });
    harness.events.length = 0;
    const callback = vi.fn(async () => {
      throw new Error("must not run");
    });

    await expect(signOutWithWebsite(accountA, callback)).resolves.toBe(false);

    expect(callback).not.toHaveBeenCalled();
    expect(await getStoredAuthTokens()).toEqual(accountB);
    expect(harness.events).toEqual([]);
    expect(harness.flushWatchHistory).not.toHaveBeenCalled();
    expect(harness.recordDiagnosticEvent).not.toHaveBeenCalled();
    expect(harness.storage.has(socialSnapshotCacheKeyForUser(accountB.user.id))).toBe(true);
    expect(harness.storage.has(accountInboxCacheKeyForUser(accountB.user.id))).toBe(true);
  });

  it("completes local-first sign-out while every offline remote stage rejects", async () => {
    await setStoredAuthTokens(accountA);
    harness.events.length = 0;
    harness.flushWatchHistory.mockImplementationOnce(async () => {
      harness.events.push("flush-history");
      throw new Error("private history failure text");
    });
    harness.revokeRefreshToken.mockImplementationOnce(async () => {
      harness.events.push("revoke-refresh");
      throw new Error("private revoke failure text");
    });
    harness.websiteLogout.mockImplementationOnce(async () => {
      harness.events.push("website-logout");
      throw new Error("private browser failure text");
    });

    await expect(signOutWithWebsite(accountA)).resolves.toBe(true);

    expect(await getStoredAuthTokens()).toBeNull();
    expect(harness.events).toEqual([
      "flush-history",
      "revoke-refresh",
      "website-logout",
      `remove:${AUTH_TOKENS_KEY}`,
      `remove:${socialSnapshotCacheKeyForUser(accountA.user.id)}`,
      `remove:${accountInboxCacheKeyForUser(accountA.user.id)}`,
    ]);
    expect(JSON.stringify(harness.recordDiagnosticEvent.mock.calls)).not.toMatch(
      /private history|private revoke|private browser/,
    );
  });

  it("times out a never-settling remote stage, attempts later stages, clears A, and preserves queued B", async () => {
    vi.useFakeTimers();
    await setStoredAuthTokens(accountA);
    harness.events.length = 0;
    const remoteGate = deferred<Response>();
    harness.revokeRefreshToken.mockImplementationOnce(() => {
      harness.events.push("revoke-refresh");
      return remoteGate.promise;
    });

    let signOutResult: boolean | undefined;
    const signOut = signOutWithWebsite(accountA).then((result) => {
      signOutResult = result;
      return result;
    });
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks(50);
    expect(harness.events).toEqual(["flush-history", "revoke-refresh"]);
    const replacement = setStoredAuthTokens(accountB);

    await vi.advanceTimersByTimeAsync(30_000);
    await flushMicrotasks();

    try {
      expect(signOutResult).toBe(true);
    } finally {
      remoteGate.resolve(new Response(null, { status: 200 }));
      await vi.runAllTimersAsync();
      await signOut;
      await replacement;
    }
    await expect(signOut).resolves.toBe(true);
    expect(harness.events).toContain("website-logout");
    expectBefore("revoke-refresh", "website-logout");
    expectBefore("website-logout", `remove:${AUTH_TOKENS_KEY}`);
    expectBefore(`remove:${AUTH_TOKENS_KEY}`, `set:${AUTH_TOKENS_KEY}`);
    expect(await getStoredAuthTokens()).toEqual(accountB);
  });
});

function expectBefore(first: string, second: string): void {
  expect(harness.events.indexOf(first), `${first} should run`).toBeGreaterThanOrEqual(0);
  expect(harness.events.indexOf(second), `${second} should run`).toBeGreaterThanOrEqual(0);
  expect(harness.events.indexOf(first)).toBeLessThan(harness.events.indexOf(second));
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(count = 8): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

function sessionFor(userId: string): ExtensionAuthTokens {
  return {
    accessToken: `access-token-${userId}`,
    refreshToken: `refresh-token-${userId}`,
    user: {
      id: userId,
      email: `${userId}@example.com`,
      displayName: userId,
      avatarUrl: null,
      plan: "free",
    },
  };
}
