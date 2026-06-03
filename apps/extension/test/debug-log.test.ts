import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDebugLog, getDebugEntries, logDebug } from "../src/debug-log";

describe("debug log", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    clearDebugLog();
  });

  it("stores debug entries without printing to the console by default", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    clearDebugLog();
    logDebug("test.scope", "captured message", {
      sourceUrl: "https://example.com/watch?token=secret",
    });

    expect(getDebugEntries()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "test.scope",
          message: "captured message",
          data: { sourceUrl: "https://example.com/watch?<redacted>" },
        }),
      ]),
    );
    expect(info).not.toHaveBeenCalled();
  });

  it("prints debug entries when console debug is explicitly enabled", () => {
    clearDebugLog();
    localStorage.setItem("anidachi:debug-console", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logDebug("test.scope", "captured message");

    expect(info).toHaveBeenCalledWith("[Anidachi Debug]", "test.scope", "captured message", "");
  });
});
