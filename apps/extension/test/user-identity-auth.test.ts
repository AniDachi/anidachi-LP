import { afterEach, describe, expect, it, vi } from "vitest";
import { ExtensionAuthTemporarilyUnavailableError } from "../src/auth-client";
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

  it("rejects a privileged identity refresh while leaving cached display available", async () => {
    const sendMessage = vi.fn(async () => ({
      ok: false,
      error: "Anidachi authentication is temporarily unavailable. Try again.",
      retryable: true,
      tokens: cachedTokens,
    }));
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    await expect(createCurrentParticipant({ requireVerified: true })).rejects.toBeInstanceOf(
      ExtensionAuthTemporarilyUnavailableError,
    );
    await expect(createCurrentParticipant()).resolves.toMatchObject({
      authenticated: true,
      tokens: cachedTokens,
    });
  });

  it("always requests server validation for privileged identity, even with fast requested", async () => {
    const sendMessage = vi.fn(async () => ({ ok: true, tokens: cachedTokens }));
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    await expect(createCurrentParticipant({ fast: true, requireVerified: true })).resolves.toMatchObject({
      authenticated: true,
      tokens: cachedTokens,
    });
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ command: "get-session" }));
  });

  it("does not turn an unverified error into a privileged signed-out result", async () => {
    vi.stubGlobal("chrome", { runtime: { sendMessage: vi.fn(async () => ({
      ok: false, error: "Profile unavailable",
    })) } });
    await expect(createCurrentParticipant({ requireVerified: true })).rejects.toThrow("Profile unavailable");
  });

  it("propagates a transport failure for actions instead of clearing identity", async () => {
    vi.stubGlobal("chrome", { runtime: { sendMessage: vi.fn(async () => {
      throw new Error("Background unavailable");
    }) } });
    await expect(createCurrentParticipant({ requireVerified: true })).rejects.toThrow("Background unavailable");
  });

});
