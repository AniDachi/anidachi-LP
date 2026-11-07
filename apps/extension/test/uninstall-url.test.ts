import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cacheKey = "anidachi-uninstall-capability-v1";
const origin = "https://www.anidachi.app";
let saved: Record<string, unknown>;
beforeEach(() => {
  vi.resetModules();
  saved = {};
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json({ version: 1, available: true })));
  vi.stubGlobal("chrome", {
    runtime: { setUninstallURL: vi.fn().mockResolvedValue(undefined) },
    storage: { local: {
      get: vi.fn(async () => saved),
      set: vi.fn(async (value: Record<string, unknown>) => { Object.assign(saved, value); }),
    } },
    alarms: { get: vi.fn().mockResolvedValue(undefined), create: vi.fn().mockResolvedValue(undefined) },
  });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

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
    expect(fetch).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledExactlyOnceWith("[AniDachi] Failed to register uninstall URL");
  });

  it("strips base path, query and hash so no identifier is registered", async () => {
    await register("staging", "https://staging.anidachi.app/account?token=private#installation-id");
    expect(chrome.runtime.setUninstallURL).toHaveBeenLastCalledWith("https://staging.anidachi.app/uninstall");
    expect(fetch).toHaveBeenCalledWith("https://staging.anidachi.app/api/extension/uninstall-capability", expect.objectContaining({ credentials: "omit", redirect: "error" }));
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("supports the configured local website port", async () => {
    await register("local", "http://localhost:3003");
    expect(chrome.runtime.setUninstallURL).toHaveBeenLastCalledWith("http://localhost:3003/uninstall");
  });

  it.each(["reject", "throw"])("contains a Chrome registration %s and reports a fixed warning", async (failure) => {
    const api = vi.mocked(chrome.runtime.setUninstallURL);
    if (failure === "reject") api.mockRejectedValueOnce(new Error("sensitive browser detail"));
    else api.mockImplementationOnce(() => { throw new Error("sensitive browser detail"); });
    await expect(register("staging", "https://staging.anidachi.app")).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledExactlyOnceWith("[AniDachi] Failed to register uninstall URL");
  });
});

describe("uninstall page rollout", () => {
  function known(available: boolean | null, age = 0, base = origin) {
    saved[cacheKey] = { origin: base, checkedAt: Date.now() - age, available };
  }
  async function production() {
    await register("production", origin);
    return import("../src/uninstall-url");
  }

  it("clears an unverified old registration before a slow readiness request, without sending identity", async () => {
    let respond!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { respond = resolve; }));
    const pending = production();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(chrome.runtime.setUninstallURL).toHaveBeenCalledExactlyOnceWith("");
    expect(fetch).toHaveBeenCalledWith(`${origin}/api/extension/uninstall-capability`, expect.objectContaining({
      credentials: "omit", redirect: "error", cache: "no-store", signal: expect.any(AbortSignal),
    }));
    respond(Response.json({ version: 1, available: true }));
    await pending;
    expect(chrome.runtime.setUninstallURL).toHaveBeenLastCalledWith(`${origin}/uninstall`);
  });

  it("keeps uninstall silent against the old server and enables it after the site deploys, without reinstall", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("old site", { status: 404 }));
    const module = await production();
    expect(chrome.runtime.setUninstallURL).toHaveBeenLastCalledWith("");
    await module.registerUninstallUrl();
    expect(fetch).toHaveBeenCalledOnce();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60 * 60 * 1000);
    await module.registerUninstallUrl();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(chrome.runtime.setUninstallURL).toHaveBeenLastCalledWith(`${origin}/uninstall`);
  });

  it("persists readiness across MV3 restarts and does not move an existing hourly alarm", async () => {
    await production();
    vi.mocked(chrome.alarms.get).mockImplementation(async () => ({ name: "anidachi-uninstall-capability", scheduledTime: Date.now() + 1234, periodInMinutes: 60 }));
    vi.mocked(chrome.alarms.create).mockClear();
    vi.resetModules();
    await production();
    expect(fetch).toHaveBeenCalledOnce();
    expect(chrome.runtime.setUninstallURL).toHaveBeenLastCalledWith(`${origin}/uninstall`);
    expect(chrome.alarms.create).not.toHaveBeenCalled();
  });

  it.each([404, 410])("clears confirmed readiness on explicit %s after rollback", async status => {
    known(true, 60 * 60 * 1000);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status }));
    await production();
    expect(chrome.runtime.setUninstallURL).toHaveBeenLastCalledWith("");
    expect(saved[cacheKey]).toMatchObject({ available: false });
  });

  it("honors an explicit versioned unavailable response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ version: 1, available: false }));
    await production();
    expect(chrome.runtime.setUninstallURL).toHaveBeenLastCalledWith("");
  });

  it.each([
    ["server error", () => new Response(null, { status: 503 })],
    ["access/login HTML", () => new Response("<html>Sign in</html>", { headers: { "Content-Type": "text/html" } })],
    ["broken JSON", () => new Response("{", { headers: { "Content-Type": "application/json" } })],
    ["unknown contract", () => Response.json({ version: 2, available: true })],
    ["arbitrary destination", () => Response.json({ version: 1, available: true, url: "https://other.example" })],
  ])("does not enable a missing page or forget a working page on %s", async (_name, response) => {
    vi.mocked(fetch).mockImplementation(async () => response());
    const module = await production();
    expect(chrome.runtime.setUninstallURL).toHaveBeenLastCalledWith("");
    known(true, 60 * 60 * 1000);
    await module.registerUninstallUrl();
    expect(chrome.runtime.setUninstallURL).toHaveBeenLastCalledWith(`${origin}/uninstall`);
  });

  it("bounds a hanging request and preserves readiness on a timeout", async () => {
    vi.useFakeTimers();
    known(true, 60 * 60 * 1000);
    let signal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      signal = init?.signal as AbortSignal;
      signal.addEventListener("abort", () => reject(new Error("timeout")));
    }));
    const pending = production();
    await vi.advanceTimersByTimeAsync(5001);
    await pending;
    expect(signal?.aborted).toBe(true);
    expect(chrome.runtime.setUninstallURL).toHaveBeenLastCalledWith(`${origin}/uninstall`);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("deduplicates concurrent startup and install requests", async () => {
    vi.stubEnv("WXT_EXTENSION_CHANNEL", "production");
    vi.stubEnv("WXT_WEB_HTTP_BASE", origin);
    const module = await import("../src/uninstall-url");
    await Promise.all([module.registerUninstallUrl(), module.registerUninstallUrl()]);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("honors browser startup's forced refresh while a cached background-start check is pending", async () => {
    known(false);
    vi.stubEnv("WXT_EXTENSION_CHANNEL", "production");
    vi.stubEnv("WXT_WEB_HTTP_BASE", origin);
    const module = await import("../src/uninstall-url");
    await Promise.all([module.registerUninstallUrl(), module.registerUninstallUrl({ force: true })]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(chrome.runtime.setUninstallURL).toHaveBeenLastCalledWith(`${origin}/uninstall`);
  });

  it("refreshes on an hourly alarm even when the previous network request made the cache younger than an hour", async () => {
    known(false, 60 * 60 * 1000 - 1000);
    vi.stubEnv("WXT_EXTENSION_CHANNEL", "production");
    vi.stubEnv("WXT_WEB_HTTP_BASE", origin);
    const module = await import("../src/uninstall-url");
    await module.registerUninstallUrl({ force: true });
    expect(fetch).toHaveBeenCalledOnce();
    expect(chrome.runtime.setUninstallURL).toHaveBeenLastCalledWith(`${origin}/uninstall`);
  });

  it("does not trust another channel's cache", async () => {
    known(true, 0, "https://staging.anidachi.app");
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await production();
    expect(chrome.runtime.setUninstallURL).toHaveBeenCalledExactlyOnceWith("");
  });

  it("recreates a missing hourly alarm and still probes if alarms or storage are unavailable", async () => {
    await production();
    expect(chrome.alarms.create).toHaveBeenCalledWith("anidachi-uninstall-capability", { periodInMinutes: 60 });
    vi.mocked(chrome.alarms.get).mockRejectedValueOnce(new Error("unavailable"));
    vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(new Error("unavailable"));
    await production();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(chrome.runtime.setUninstallURL).toHaveBeenLastCalledWith(`${origin}/uninstall`);
  });
});
