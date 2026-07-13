import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAuthTokens } from "../src/auth-tokens";
import { createCurrentParticipant } from "../src/user-identity";

const cachedTokens: ExtensionAuthTokens = {
  accessToken: "expired-access",
  refreshToken: "refresh",
  user: {
    id: "user-1",
    email: "user@example.com",
    displayName: "Alina",
    avatarUrl: null,
    plan: "plus",
  },
};

describe("extension identity during temporary auth failures", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps cached identity visible while authenticated actions remain retryable", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async () => ({
          ok: false,
          error: "Anidachi authentication is temporarily unavailable. Try again.",
          retryable: true,
          tokens: cachedTokens,
        })),
      },
    });

    await expect(createCurrentParticipant()).resolves.toMatchObject({
      authenticated: true,
      tokens: cachedTokens,
      message: "Anidachi authentication is temporarily unavailable. Try again.",
      participant: {
        id: "user-1",
        displayName: "Alina",
      },
    });
  });
});
