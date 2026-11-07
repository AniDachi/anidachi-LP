import { describe, expect, it } from "vitest";
import { ClientEventSchema, ServerEventSchema } from "../src/index";
import { free, serverTime } from "./fixtures/hosting-time";

const event = {
	type: "HOSTING_TIME",
	roomId: free.roomId,
	roomGeneration: free.roomGeneration,
	serverTime,
	validUntil: serverTime + 60_000,
	snapshot: free,
};
describe("negotiated live hosting time", () => {
	it("accepts an independent fresh event without altering legacy room snapshots", () => {
		expect(ServerEventSchema.safeParse(event).success).toBe(true);
	});
	it("rejects mismatched envelope scope/time and unbounded freshness", () => {
		for (const patch of [
			{ roomId: "different-room" },
			{ roomGeneration: free.roomGeneration + 1 },
			{ serverTime: serverTime + 1 },
			{ validUntil: serverTime },
			{ validUntil: serverTime + 300_001 },
		])
			expect(ServerEventSchema.safeParse({ ...event, ...patch }).success).toBe(
				false,
			);
	});
	it("accepts explicit recovery requests scoped to the current room", () => {
		expect(
			ClientEventSchema.safeParse({
				type: "HOSTING_TIME_REQUEST", requestId:"8fb7bc8d-49ef-4f43-9de3-1b6b31716c00",
				roomId: free.roomId,
			}).success,
		).toBe(true);
	});
});

it('binds recovery to a fresh correlated response',()=>{
  const requestId='8fb7bc8d-49ef-4f43-9de3-1b6b31716c00';
  expect(ClientEventSchema.parse({type:'HOSTING_TIME_REQUEST',roomId:free.roomId,requestId})).toMatchObject({requestId});
  expect(ServerEventSchema.safeParse({...event,requestId}).success).toBe(true);
});

it('accepts an explicitly negotiated immutable legacy room mode without a time grant',()=>{
  expect(ServerEventSchema.safeParse({type:'HOSTING_TIME_LEGACY',roomId:free.roomId,roomGeneration:1}).success).toBe(true);
  expect(ServerEventSchema.safeParse({type:'HOSTING_TIME_LEGACY',roomId:free.roomId,roomGeneration:1,remainingSeconds:1200}).success).toBe(false);
});
