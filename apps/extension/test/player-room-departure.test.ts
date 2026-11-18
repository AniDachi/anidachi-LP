import { expect, it, vi } from "vitest";
import {
	handlePlayerRoomDeparture,
	PLAYER_ROOM_DEPARTURE,
} from "../src/player-room-departure";
import {
	createRoomDepartureRetryCoordinator,
	claimPersistedRoomDeparture,
} from "../src/room-departure-retry";
import * as sessions from "../src/room-session-storage";

const record = {
	version: 1 as const,
	revision: 1,
	roomId: "11111111-1111-4111-8111-111111111111",
	ownerUserId: "user-a",
	participantSessionId: "session-a",
	cameraEnabled: false,
	voiceMode: "push-to-talk" as const,
};
const sender = { tab: { id: 12 } };
const message = {
	type: PLAYER_ROOM_DEPARTURE,
	roomId: record.roomId,
	ownerUserId: record.ownerUserId,
	participantSessionId: record.participantSessionId,
};

async function setup() {
	const area = () => {
		const data = new Map<string, unknown>();
		return {
			get: async (key: string) => ({ [key]: data.get(key) }),
			set: async (items: Record<string, unknown>) => {
				for (const [key, value] of Object.entries(items)) data.set(key, value);
			},
			remove: async (key: string) => { data.delete(key); },
		};
	};
	const storage = { sessionStorage: area(), localStorage: area(), randomUUID: () => crypto.randomUUID() };
	const prepared = await sessions.prepareRoomSessionForTab(12, record, storage);
	const saved = (await sessions.confirmRoomSessionForTab(12, prepared, record.roomId, storage))!;
	const request = { ...message, participantSessionId: saved.participantSessionId };
	const operation = { roomId: saved.roomId, ownerUserId: saved.ownerUserId, participantSessionId: saved.participantSessionId, generation: 1 };
	return { storage, saved, request, operation };
}

it("cannot restore a closed room while the server is still processing departure", async () => {
	const { storage, request, operation } = await setup();
	const network = Promise.withResolvers<void>();
	const started = Promise.withResolvers<void>();
	const depart = async () => { started.resolve(); await network.promise; return "room_ended" as const; };
	const result = handlePlayerRoomDeparture(request, sender, {
		storage, claim: async () => operation, settle: depart,
	});
	try {
		await started.promise;
		expect(await sessions.loadRoomSessionForTab(12, storage)).toBeNull();
	} finally {
		network.resolve();
		await result;
	}
});
it.each([
	"room_ended",
	"departed",
] as const)("uses the exact persisted departure for %s", async (outcome) => {
	const { storage, request, saved, operation } = await setup();
	const claim = vi.fn(async () => operation);
	const settle = vi.fn(async () => outcome);
	expect(await handlePlayerRoomDeparture(request, sender, { storage, claim, settle })).toEqual({ ok: true });
	expect(claim).toHaveBeenCalledExactlyOnceWith(saved);
	expect(settle).toHaveBeenCalledExactlyOnceWith(operation);
	expect(await sessions.loadRoomSessionForTab(12, storage)).toBeNull();
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
	const { storage, request } = await setup();
	expect(await handlePlayerRoomDeparture(request, sender, {
		storage,
		claim: (r) => claimPersistedRoomDeparture(r, coordinator),
		settle: coordinator.settleAdmission,
	})).toEqual({ ok: true });
	expect(await sessions.loadRoomSessionForTab(12, storage)).toBeNull();
	expect(state).toMatchObject({ jobs: [expect.objectContaining({
		cleanupRequested: true, participantSessionId: request.participantSessionId,
	})] });
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
	const { storage, request, saved } = await setup();
	const claim = vi.fn();
	const settle = vi.fn();
	const result = await handlePlayerRoomDeparture({
		...request,
		...(mode === "account" ? { ownerUserId: "user-b" } : {}),
		...(mode === "room" ? { roomId: "22222222-2222-4222-8222-222222222222" } : {}),
		...(mode === "session" ? { participantSessionId: "other" } : {}),
	}, mode === "tab" ? {} : { tab: { id: mode === "missing" ? 13 : 12 } }, { storage, claim, settle });
	expect(result.ok).toBe(false);
	expect(claim).not.toHaveBeenCalled();
	expect(settle).not.toHaveBeenCalled();
	expect(await sessions.loadRoomSessionForTab(12, storage)).toEqual(saved);
});
it("does not clear recovery if durable queue persistence fails", async () => {
	const { storage, request, saved } = await setup();
	const settle = vi.fn();
	const claim = vi.fn().mockRejectedValue(Error("storage unavailable"));
	expect(await handlePlayerRoomDeparture(request, sender, { storage, claim, settle })).toEqual({ ok: false });
	expect(settle).not.toHaveBeenCalled();
	expect(await sessions.loadRoomSessionForTab(12, storage)).toEqual(saved);
});
it("keeps the local exit final when an already scheduled server attempt throws", async () => {
	const { storage, request, operation } = await setup();
	const settle = vi.fn().mockRejectedValue(Error("worker interrupted"));
	expect(await handlePlayerRoomDeparture(request, sender, {
		storage, claim: async () => operation, settle,
	})).toEqual({ ok: true });
	expect(await sessions.loadRoomSessionForTab(12, storage)).toBeNull();
});
it("serializes an immediate reopen and preserves a newer prepared room", async () => {
	const { storage, request, saved, operation } = await setup();
	const next = await sessions.prepareRoomSessionForTab(12, { ownerUserId: saved.ownerUserId, roomId: null }, storage);
	const gate = Promise.withResolvers<void>();
	const exit = handlePlayerRoomDeparture(request, sender, {
		storage,
		claim: async () => { await gate.promise; return operation; },
		settle: async () => "room_ended",
	});
	const reopened = sessions.loadRoomSessionForTab(12, storage);
	gate.resolve();
	expect(await reopened).toBeNull();
	expect((await exit).ok).toBe(true);
	expect(await sessions.confirmRoomSessionForTab(12, next, saved.roomId, storage)).toMatchObject({
		participantSessionId: next.participantSessionId,
	});
});
