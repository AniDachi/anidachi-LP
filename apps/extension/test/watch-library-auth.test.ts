import { describe, expect, it } from "vitest";
import type { ExtensionAuthTokens } from "../src/auth-tokens";
import type { CurrentParticipantResult } from "../src/user-identity";
import { resolveWatchLibraryReconcileAuth } from "../src/watch-library-auth";

const tokens: ExtensionAuthTokens = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  user: {
    id: "user-1",
    email: "user@example.com",
    displayName: "Alina",
    avatarUrl: null,
    plan: "plus",
  },
};

function participantResult(
  overrides: Partial<CurrentParticipantResult> = {},
): CurrentParticipantResult {
  return {
    participant: null,
    authenticated: true,
    tokens,
    ...overrides,
  };
}

describe("watch library reconcile auth", () => {
  it("uses the cached access token when it still belongs to the current overlay user", () => {
    expect(resolveWatchLibraryReconcileAuth("user-1", participantResult())).toEqual({
      accessToken: "access-1",
      currentUserId: "user-1",
      reason: "ok",
      tokenUserId: "user-1",
    });
  });

  it("skips remote history sync instead of clearing room state when auth is temporarily unavailable", () => {
    expect(
      resolveWatchLibraryReconcileAuth(
        "user-1",
        participantResult({
          authenticated: false,
          tokens: null,
        }),
      ),
    ).toEqual({
      accessToken: null,
      currentUserId: "user-1",
      reason: "not-signed-in",
      tokenUserId: null,
    });
  });

  it("skips remote history sync when the cached token belongs to a different user", () => {
    expect(
      resolveWatchLibraryReconcileAuth(
        "user-1",
        participantResult({
          tokens: {
            ...tokens,
            accessToken: "access-2",
            user: {
              ...tokens.user,
              id: "user-2",
            },
          },
        }),
      ),
    ).toEqual({
      accessToken: null,
      currentUserId: "user-1",
      reason: "user-mismatch",
      tokenUserId: "user-2",
    });
  });
});
