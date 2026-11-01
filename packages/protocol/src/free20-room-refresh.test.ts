import { describe, expect, it } from "vitest";
import * as protocol from "./index";

const request = {
 refreshVersion: 1, ownerUserId: "11111111-1111-4111-8111-111111111111",
 roomId: "purchase-room", roomGeneration: 1, revision: 7,
};
describe("Free20 refresh command", () => {
 it("accepts a strictly bound positive safe revision and echoes the whole request in every receipt", () => {
  expect(protocol.Free20RoomRefreshRequestSchema.parse(request)).toEqual(request);
  for (const outcome of ["applied", "terminal", "stale"])
   expect(protocol.Free20RoomRefreshReceiptSchema.parse({ request, outcome })).toEqual({ request, outcome });
 });
 it("rejects unbound, client-authoritative, unsafe and incompatible commands", () => {
  for (const invalid of [
   { ...request, refreshVersion: 2 }, { ...request, ownerUserId: "owner" },
   { ...request, roomId: "" }, { ...request, roomGeneration: 0 },
   { ...request, revision: 0 }, { ...request, revision: -1 },
   { ...request, revision: 1.5 }, { ...request, revision: Number.MAX_SAFE_INTEGER + 1 },
   { ...request, entitlement: "plus" }, { ...request, allowance: 1200 },
   { ...request, clientTime: Date.now() }, { ...request, revision: undefined },
  ]) expect(protocol.Free20RoomRefreshRequestSchema.safeParse(invalid).success).toBe(false);
  for (const invalid of [
   { request, outcome: "unknown" }, { request, outcome: "applied", unlimited: true },
   { request: { ...request, allowance: 1200 }, outcome: "applied" },
   { outcome: "applied" },
  ]) expect(protocol.Free20RoomRefreshReceiptSchema.safeParse(invalid).success).toBe(false);
 });
});
