import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("chrome", { runtime: { setUninstallURL: vi.fn().mockResolvedValue(undefined) } });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function register(channel: string, base: string) {
  vi.stubEnv("WXT_EXTENSION_CHANNEL", channel);
  vi.stubEnv("WXT_WEB_HTTP_BASE", base);
  await (await import("../src/uninstall-url")).registerUninstallUrl();
}

describe("uninstall URL safety", () => {
  it.each([
    ["staging", "https://www.anidachi.app"],
    ["production", "https://staging.anidachi.app"],
    ["staging", "https://staging.anidachi.app.evil.example"],
    ["staging", "http://staging.anidachi.app"],
    ["production", "https://www.anidachi.app:444"],
    ["production", "https://user:secret@www.anidachi.app"],
    ["local", "file:///tmp/index.html"],
    ["local", "javascript:alert(1)"],
    ["local", "not a URL"],
    ["unknown", "https://www.anidachi.app"],
  ])("rejects an invalid %s base %s without exposing it in diagnostics", async (channel, base) => {
    await expect(register(channel, base)).resolves.toBeUndefined();
    expect(chrome.runtime.setUninstallURL).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledExactlyOnceWith("[AniDachi] Failed to register uninstall URL");
  });

  it("strips base path, query and hash so no identifier is registered", async () => {
    await register("staging", "https://staging.anidachi.app/account?token=private#installation-id");
    expect(chrome.runtime.setUninstallURL).toHaveBeenCalledExactlyOnceWith("https://staging.anidachi.app/uninstall");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("supports the configured local website port", async () => {
    await register("local", "http://localhost:3003");
    expect(chrome.runtime.setUninstallURL).toHaveBeenCalledExactlyOnceWith("http://localhost:3003/uninstall");
  });

  it.each(["reject", "throw"])("contains a Chrome registration %s and reports a fixed warning", async (failure) => {
    const api = vi.mocked(chrome.runtime.setUninstallURL);
    if (failure === "reject") api.mockRejectedValueOnce(new Error("sensitive browser detail"));
    else api.mockImplementationOnce(() => { throw new Error("sensitive browser detail"); });
    await expect(register("staging", "https://staging.anidachi.app")).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledExactlyOnceWith("[AniDachi] Failed to register uninstall URL");
  });
});
