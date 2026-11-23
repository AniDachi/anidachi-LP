import { expect, it, vi } from "vitest";
import {
	handlePlayerRoomDeparture,
	PLAYER_ROOM_DEPARTURE,
} from "../src/player-room-departure";
import {
	createRoomDepartureRetryCoordinator,
	departPersistedRoomSession,
} from "../src/room-departure-retry";

const record = {
	version: 1 as const,
	revision: 1,
	roomId: "11111111-1111-4111-8111-111111111111",
	ownerUserId: "user-a",
	participantSessionId: "session-a",
	cameraEnabled: false,
	voiceMode: "push-to-talk" as const,
};
const message = {
	type: PLAYER_ROOM_DEPARTURE,
	roomId: record.roomId,
	ownerUserId: record.ownerUserId,
	participantSessionId: record.participantSessionId,
};
it.each([
	"room_ended",
	"departed",
] as const)("uses the exact persisted departure for %s", async (outcome) => {
	const depart = vi.fn(async () => outcome),
		clear = vi.fn(async () => true);
	expect(
		await handlePlayerRoomDeparture(
			message,
			{ tab: { id: 12 } },
			{ load: async () => record, depart, clear },
		),
	).toEqual({ ok: true });
	expect(depart).toHaveBeenCalledExactlyOnceWith(record);
	expect(clear).toHaveBeenCalledExactlyOnceWith(12, record);
	expect(depart.mock.invocationCallOrder[0]).toBeLessThan(
		clear.mock.invocationCallOrder[0]!,
	);
});
it("keeps an offline exit in the existing durable queue before clearing local recovery", async () => {
	let state: unknown = null,
		now = 1000;
	const attempt = vi
		.fn()
		.mockResolvedValueOnce("retryable")
		.mockResolvedValue("room_ended");
	const coordinator = createRoomDepartureRetryCoordinator({
		storage: {
			read: async () => state,
			write: async (next) => {
				state = next;
			},
			clear: async () => {
				state = null;
			},
		},
		scheduler: { replace: async () => {} },
		getCurrentUserId: async () => record.ownerUserId,
		departExact: attempt,
		now: () => now,
	});
	const clear = vi.fn(async () => {
		expect(state).toMatchObject({
			jobs: [
				expect.objectContaining({
					cleanupRequested: true,
					participantSessionId: record.participantSessionId,
				}),
			],
		});
		return true;
	});
	expect(
		await handlePlayerRoomDeparture(
			message,
			{ tab: { id: 12 } },
			{
				load: async () => record,
				depart: (r) => departPersistedRoomSession(r, coordinator),
				clear,
			},
		),
	).toEqual({ ok: true });
	now += 120000;
	await coordinator.drain({ force: true });
	expect(attempt).toHaveBeenCalledTimes(2);
});
it.each([
	"account",
	"room",
	"session",
	"missing",
	"tab",
])("rejects %s mismatch without departing a successor", async (mode) => {
	const next = {
		...record,
		...(mode === "account"
			? { ownerUserId: "user-b" }
			: mode === "room"
				? { roomId: "other" }
				: mode === "session"
					? { participantSessionId: "other" }
					: {}),
	};
	const depart = vi.fn(),
		clear = vi.fn();
	const result = await handlePlayerRoomDeparture(
		message,
		mode === "tab" ? {} : { tab: { id: 12 } },
		{ load: async () => (mode === "missing" ? null : next), depart, clear },
	);
	expect(result.ok).toBe(false);
	expect(depart).not.toHaveBeenCalled();
	expect(clear).not.toHaveBeenCalled();
});
it("does not clear recovery if durable queue persistence fails", async () => {
	const clear = vi.fn();
	expect(
		(
			await handlePlayerRoomDeparture(
				message,
				{ tab: { id: 12 } },
				{
					load: async () => record,
					depart: async () => {
						throw Error("storage unavailable");
					},
					clear,
				},
			)
		).ok,
	).toBe(false);
	expect(clear).not.toHaveBeenCalled();
});
