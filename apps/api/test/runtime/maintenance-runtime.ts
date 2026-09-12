import { createExecutionContext, createScheduledController, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, expect, it, vi } from "vitest";
import worker from "../../src/index";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each(["closed", "invalid"])("Workerd entrypoints deny %s without namespace or HTTP delivery", async (mode) => {
  const http = vi.fn(() => { throw new Error("Unexpected HTTP"); });
  vi.stubGlobal("fetch", http);
  const diagnostics = vi.spyOn(console, "info").mockImplementation(() => {});
  const env = {
    ANIDACHI_MAINTENANCE_MODE: mode,
    get ROOMS(): never { throw new Error("Unexpected room namespace access"); },
  };
  const ctx = createExecutionContext();
  for (const [method, path] of [
    ["GET", "/ws/room-1?token=existing-token"],
    ["GET", "/rooms/room-1/ice-servers"],
    ["POST", "/internal/rooms/room-1/end"],
  ] as const) {
    const response = await worker.fetch(new Request(`https://worker.test${path}`, {
      method, headers: { Upgrade: "websocket", Authorization: "Bearer internal-secret" },
    }), env, ctx);
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("X-Anidachi-Maintenance")).toBe("closed");
    expect(await response.json()).toEqual({ error: "MAINTENANCE", message: "AniDachi is temporarily unavailable. Please try again shortly." });
  }
  await worker.scheduled(createScheduledController({ cron: "* * * * *" }), env, ctx);
  await waitOnExecutionContext(ctx);
  expect(http).not.toHaveBeenCalled();
  expect(diagnostics).toHaveBeenCalledExactlyOnceWith("[anidachi/inbox-push] scheduler", { outcome: "maintenance_skipped" });
});
