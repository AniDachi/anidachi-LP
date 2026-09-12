import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/index";

const routes = [
  ["GET", "/ws/room-1?token=existing-token"],
  ["GET", "/rooms/room-1/ice-servers"],
  ["POST", "/rooms"],
  ["POST", "/internal/rooms/room-1/end"],
  ["POST", "/internal/rooms/room-1/participants/user-1/depart"],
  ["POST", "/internal/rooms/room-1/participants/user-1/detach"],
  ["POST", "/"],
  ["HEAD", "/"],
  ["GET", "/unknown-route"],
] as const;
afterEach(() => { vi.restoreAllMocks(); });

describe("central Worker maintenance admission", () => {
  it.each(["closed", "invalid", "OPEN"])("denies all admissions in %s before namespace, credentials or HTTP", async (mode) => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No outbound HTTP permitted"));
    const reads: string[] = [];
    const env = new Proxy({ ANIDACHI_MAINTENANCE_MODE: mode }, {
      get(target, key) {
        reads.push(String(key));
        if (key !== "ANIDACHI_MAINTENANCE_MODE") throw new Error(`Unexpected binding ${String(key)}`);
        return target.ANIDACHI_MAINTENANCE_MODE;
      },
    });
    for (const [method, path] of routes) {
      const response = await app.request(path, {
        method, headers: { Authorization: "Bearer internal-secret", Upgrade: "websocket", Origin: "https://spoofed.example", "X-Anidachi-Maintenance": "open" },
      }, env);
      expect(response.status).toBe(503);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("Retry-After")).toBe("60");
      expect(response.headers.get("X-Anidachi-Maintenance")).toBe("closed");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      if (method !== "HEAD") expect(await response.json()).toEqual({ error: "MAINTENANCE", message: "AniDachi is temporarily unavailable. Please try again shortly." });
    }
    expect(reads.every((key) => key === "ANIDACHI_MAINTENANCE_MODE")).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([undefined, "", "open"])("preserves health and existing route responses when %j", async (mode) => {
    const env = { ANIDACHI_MAINTENANCE_MODE: mode };
    const health = await app.request("/", {}, env);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true, service: "anidachi-api" });
    const retired = await app.request("/rooms", { method: "POST" }, env);
    expect(retired.status).toBe(410);
    expect(retired.headers.has("X-Anidachi-Maintenance")).toBe(false);
  });
  it("allows read-only health and CORS preflight during closure", async () => {
    const env = { ANIDACHI_MAINTENANCE_MODE: "closed" };
    const health = await app.request("/", {}, env);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true, service: "anidachi-api", maintenance: "closed" });
    const options = await app.request("/ws/room-1", { method: "OPTIONS", headers: { Origin: "https://example.com", "Access-Control-Request-Method": "GET" } }, env);
    expect(options.status).toBe(204);
    expect(options.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
