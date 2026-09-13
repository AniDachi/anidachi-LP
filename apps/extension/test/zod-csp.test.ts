import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.restoreAllMocks(); });

describe("extension validation under strict MV3 CSP", () => {
  it("constructs and validates protocol schemas without even probing Function", async () => {
    vi.resetModules();
    const compile = vi.spyOn(globalThis, "Function").mockImplementation(() => {
      throw new EvalError("String code generation is disallowed by MV3 CSP");
    });
    await import("../src/zod-csp");
    const { WatchHistoryPreferencesSchema, PersonalHistoryResumeSchema, ClientEventSchema } = await import("@anidachi/protocol");
    expect(WatchHistoryPreferencesSchema.safeParse({ youtubeHistoryEnabled: true }).success).toBe(true);
    expect(WatchHistoryPreferencesSchema.safeParse({ youtubeHistoryEnabled: "true" }).success).toBe(false);
    expect(PersonalHistoryResumeSchema.safeParse({ sourceUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(ClientEventSchema.safeParse({ type: "P2P_SIGNAL", payload: {} }).success).toBe(false);
    expect(compile).not.toHaveBeenCalled();
  });
});
