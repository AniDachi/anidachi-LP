import { describe, it, expect } from "vitest";
import { RoomPresenceEvidenceSchema } from "./room-presence-evidence";
const value = {
	roomId: "room",
	roomGeneration: 7,
	observedAt: 1000,
	participants: [
		{ userId: "00000000-0000-4000-8000-000000000001", sessionId: "session-a" },
		{ userId: "00000000-0000-4000-8000-000000000002", sessionId: "session-b" },
	],
};
describe("private room presence contract", () => {
	it("accepts only a canonical server observation, never viewing data", () => {
		expect(RoomPresenceEvidenceSchema.safeParse(value).success).toBe(true);
		for (const extra of [
			{ title: "video" },
			{ provider: "youtube" },
			{ position: 5 },
			{ historySessionId: "x" },
		])
			expect(
				RoomPresenceEvidenceSchema.safeParse({ ...value, ...extra }).success,
			).toBe(false);
		expect(
			RoomPresenceEvidenceSchema.safeParse({
				...value,
				participants: [value.participants[0], value.participants[0]],
			}).success,
		).toBe(false);
		expect(
			RoomPresenceEvidenceSchema.safeParse({
				...value,
				participants: [...value.participants].reverse(),
			}).success,
		).toBe(false);
		for (const roomGeneration of [0, -1, 1.5, "1", Number.MAX_SAFE_INTEGER + 1])
			expect(
				RoomPresenceEvidenceSchema.safeParse({ ...value, roomGeneration })
					.success,
			).toBe(false);
	});
});
