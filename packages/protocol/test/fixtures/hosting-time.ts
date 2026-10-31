/** Hand-authored boundary data; no production issuance or entitlement builder. */
export const serverTime = Date.parse("2026-10-30T12:00:00Z");
export const resetAt = Date.parse("2026-10-31T00:00:00Z");
export const binding = {
	ownerUserId: "11111111-1111-4111-8111-111111111111",
	roomId: "free-room",
	roomGeneration: 2,
	utcDay: "2026-10-30",
};
export const free = {
	hostingTimeVersion: 1,
	ownerUserId: binding.ownerUserId,
	roomId: binding.roomId,
	roomGeneration: 2,
	snapshotSequence: 4,
	serverTime,
	period: { utcDay: "2026-10-30", resetAt },
	access: {
		kind: "daily_free",
		budgetSeconds: 1200,
		usedSeconds: 400,
		remainingSeconds: 800,
		metering: true,
	},
};
