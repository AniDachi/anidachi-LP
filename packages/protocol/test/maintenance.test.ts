import { describe, expect, it } from "vitest";
import { parseMaintenanceMode, maintenanceHttpResponse } from "../src/index";

describe("maintenance HTTP admission contract", () => {
  it.each([undefined, "", "open"])("defaults %j to open", (value) => {
    expect(parseMaintenanceMode(value)).toBe("open");
  });
  it.each(["closed", "CLOSED", "OPEN", " open", "open ", " ", "false", "probe"])("fails closed for %j", (value) => {
    expect(parseMaintenanceMode(value)).toBe("closed");
  });
  it("returns the stable retryable HTTP response without shared mutable state", () => {
    const contract = maintenanceHttpResponse();
    expect(contract).toEqual({
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "60", "X-Anidachi-Maintenance": "closed" },
      body: { error: "MAINTENANCE", message: "AniDachi is temporarily unavailable. Please try again shortly." },
    });
    contract.headers["Retry-After"] = "0";
    expect(maintenanceHttpResponse().headers["Retry-After"]).toBe("60");
  });
});
