import { describe, expect, it, vi } from "vitest";
import {
  adoptWebsiteSessionWithRetry,
  type SilentSessionAdoptionResult,
} from "../src/silent-session-adoption";
import type { CurrentParticipantResult } from "../src/user-identity";

const signedOut: CurrentParticipantResult = {
  authenticated: false,
  participant: null,
  tokens: null,
};

const signedIn: CurrentParticipantResult = {
  authenticated: true,
  participant: {
    id: "user-1",
    displayName: "Alina",
    role: "viewer",
    cameraEnabled: false,
    syncStatus: "unknown",
    lastSeenAt: 1,
  },
  tokens: {
    accessToken: "access-1",
    refreshToken: "refresh-1",
    user: {
      id: "user-1",
      email: "alina@example.com",
      displayName: "Alina",
      avatarUrl: null,
      plan: "plus",
    },
  },
};

describe("silent website session adoption", () => {
  it("retries short-lived silent sign-in misses so the overlay adopts website auth without reload", async () => {
    vi.useFakeTimers();
    const readCurrentIdentity = vi.fn(async () => signedOut);
    const trySilentSignIn = vi
      .fn<() => Promise<CurrentParticipantResult | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(signedIn);
    const seen: SilentSessionAdoptionResult[] = [];

    const pending = adoptWebsiteSessionWithRetry({
      initialResult: signedOut,
      readCurrentIdentity,
      trySilentSignIn,
      shouldContinue: () => true,
      delaysMs: [100, 250],
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      onAttempt: (result) => seen.push(result),
    });

    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();

    await expect(pending).resolves.toEqual({
      reason: "silent-sign-in",
      result: signedIn,
    });
    expect(trySilentSignIn).toHaveBeenCalledTimes(3);
    expect(readCurrentIdentity).toHaveBeenCalledTimes(2);
    expect(seen.map((result) => result.reason)).toEqual([
      "initial",
      "silent-miss",
      "current-miss",
      "silent-miss",
      "current-miss",
      "silent-sign-in",
    ]);
    vi.useRealTimers();
  });

  it("stops retrying when silent adoption is suppressed", async () => {
    const readCurrentIdentity = vi.fn(async () => signedOut);
    const trySilentSignIn = vi.fn(async () => signedIn);

    await expect(
      adoptWebsiteSessionWithRetry({
        initialResult: signedOut,
        readCurrentIdentity,
        trySilentSignIn,
        shouldContinue: () => false,
        delaysMs: [100, 250],
      }),
    ).resolves.toEqual({ reason: "cancelled", result: null });
    expect(trySilentSignIn).not.toHaveBeenCalled();
    expect(readCurrentIdentity).not.toHaveBeenCalled();
  });
});
