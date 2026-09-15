import { describe, expect, it } from "vitest";
import { RoomQuotaStatusSchema } from "../src/room-quota-status";

const base = { schemaVersion: 1, ownerUserId: "11111111-1111-4111-8111-111111111111", serverTime: "2026-09-15T23:59:50Z", quota: { remainingSeconds: 0, resetAt: "2026-09-16T00:00:00Z" } };
describe("server daily quota status", () => {
  it("accepts equivalent timezone representations of the same reset instant", () => {
    expect(RoomQuotaStatusSchema.safeParse(base).success).toBe(true);
    expect(RoomQuotaStatusSchema.safeParse({ ...base, serverTime: "2026-09-16T13:59:50+14:00", quota: { ...base.quota, resetAt: "2026-09-15T20:00:00-04:00" } }).success).toBe(true);
    expect(RoomQuotaStatusSchema.safeParse({ ...base, quota: null }).success).toBe(true);
  });
  it.each([
    { serverTime: "bad" }, { ownerUserId: "" },
    { quota: { remainingSeconds: -1, resetAt: base.quota.resetAt } },
    { quota: { remainingSeconds: 1801, resetAt: base.quota.resetAt } },
    { quota: { remainingSeconds: 0, resetAt: "2026-09-17T00:00:00Z" } },
    { quota: { remainingSeconds: 0, resetAt: "2026-09-15T00:00:00Z" } },
  ])("rejects unusable or non-UTC-day data (%#)", (patch) => {
    expect(RoomQuotaStatusSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });
});
