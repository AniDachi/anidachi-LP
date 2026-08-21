import {
	evictDurableObject,
	reset,
	runDurableObjectAlarm,
	runInDurableObject,
} from "cloudflare:test";
import { env } from "cloudflare:workers";
import {
	EMPTY_ROOM_TIMEOUT_MS,
	ROOM_HISTORY_OFFLINE_GRACE_SECONDS,
	type Participant,
	type ServerEvent,
	ServerEventSchema,
	createEmptyRoomEndEventId,
} from "@anidachi/protocol";
import { jwtVerify } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signRoomTokenForTest } from "../../src/auth";

const TEST_SECRET_ENV = { ANIDACHI_JWT_SECRET: "anidachi-runtime-test-secret" };
const INTERNAL_SECRET = "anidachi-runtime-internal-secret";
const ROOM_LIFECYCLE_META_KEY = "room_lifecycle";

function stubSuccessfulWebFinalization() {
	const callbackFetch = vi.fn(async () =>
		Response.json({ ok: true, usageFinalized: true }),
	);
	vi.stubGlobal("fetch", callbackFetch);
	return callbackFetch;
}

afterEach(async () => {
	vi.unstubAllGlobals();
	await reset();
});

describe("RoomDurableObject WebSocket hibernation", () => {
	it("rejects subject admission capacity before retaining a third pre-JOIN socket", async () => {
		const roomId = `runtime-admission-capacity-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const first = await openRoomSocket(stub, { roomId, role: "member", userId: "member-1" });
		const second = await openRoomSocket(stub, { roomId, role: "member", userId: "member-1" });
		const token = await roomToken(roomId, "member", "member-1");

		const rejected = await stub.fetch(
			`https://room.test/?roomToken=${encodeURIComponent(token)}`,
			{ headers: { Upgrade: "websocket" } },
		);
		expect(rejected.status).toBe(429);
		expect(await runInDurableObject(stub, (_instance, state) => state.getWebSockets().length)).toBe(2);

		first.close();
		second.close();
	});

	it("releases pending admission after a socket error", async () => {
		const roomId = `runtime-admission-rehydrate-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const first = await openRoomSocket(stub, { roomId, role: "member", userId: "member-1" });
		const second = await openRoomSocket(stub, { roomId, role: "member", userId: "member-1" });

		await runInDurableObject(stub, async (instance, state) => {
			const socket = state.getWebSockets()[0];
			if (!socket) throw new Error("expected pending socket");
			await (instance as { webSocketError(socket: WebSocket, error: unknown): Promise<void> })
				.webSocketError(socket, new Error("test socket error"));
		});
		const replacement = await openRoomSocket(stub, { roomId, role: "member", userId: "member-1" });

		first.close();
		second.close();
		replacement.close();
	});

	it("releases pending admission after a socket close", async () => {
		const roomId = `runtime-admission-close-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const first = await openRoomSocket(stub, { roomId, role: "member", userId: "member-1" });
		const second = await openRoomSocket(stub, { roomId, role: "member", userId: "member-1" });

		first.close();
		await sleep(50);
		const replacement = await openRoomSocket(stub, { roomId, role: "member", userId: "member-1" });

		second.close();
		replacement.close();
	});

	it("keeps a subject control budget across a close-gap replacement", async () => {
		const roomId = `runtime-admission-rate-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const original = await openRoomSocket(stub, { roomId, role: "member", userId: "member-1" });
		for (let index = 0; index < 39; index += 1) {
			original.send({ type: "PING", roomId, sentAt: index });
		}
		await sleep(50);
		original.close();
		await sleep(900);
		const replacement = await connectRoomClient(stub, {
			roomId, role: "member", sessionId: "replacement-session", userId: "member-1",
		});
		replacement.send({ type: "PING", roomId, sentAt: 99 });
		await replacement.waitFor(
			(event) => event.type === "ERROR" && event.code === "RATE_LIMITED",
			"replacement shares subject control budget",
		);
		replacement.close();
	});

	it("issues private history authority after durable join and refreshes it after hibernation", async () => {
		const roomId = `runtime-history-authority-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-history-session", userId: "host-user",
		});
		const guest = await connectRoomClient(stub, {
			roomId, role: "member", sessionId: "guest-history-session", userId: "guest-user",
		});

		const hostInitial = await host.waitFor(
			(event) =>
				event.type === "ROOM_HISTORY_AUTHORITY" &&
				event.participantSessionId === "host-history-session",
			"host initial history authority",
		);
		const guestInitial = await guest.waitFor(
			(event) =>
				event.type === "ROOM_HISTORY_AUTHORITY" &&
				event.participantSessionId === "guest-history-session",
			"guest initial history authority",
		);
		expect(hostInitial).toMatchObject({
			type: "ROOM_HISTORY_AUTHORITY",
			roomId,
			participantSessionId: "host-history-session",
			roomGeneration: 1,
			sourceGeneration: 1,
		});
		expect(guestInitial).toMatchObject({
			type: "ROOM_HISTORY_AUTHORITY",
			roomId,
			participantSessionId: "guest-history-session",
			roomGeneration: 1,
			sourceGeneration: 1,
		});
		if (hostInitial.type !== "ROOM_HISTORY_AUTHORITY") {
			throw new Error("Expected host history authority");
		}
		const { payload, protectedHeader } = await jwtVerify(
			hostInitial.attestation,
			new TextEncoder().encode(TEST_SECRET_ENV.ANIDACHI_JWT_SECRET),
			{
				algorithms: ["HS256"],
				issuer: "anidachi-worker",
				audience: "anidachi-web-history",
				requiredClaims: ["exp", "iat", "jti"],
			},
		);
		expect(protectedHeader).toEqual({ alg: "HS256" });
		expect(payload.exp).toBe(payload.iat! + ROOM_HISTORY_OFFLINE_GRACE_SECONDS);
		expect(payload.jti).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
		expect(host.hasEvent(
			(event) =>
				event.type === "ROOM_HISTORY_AUTHORITY" &&
				event.participantSessionId === "guest-history-session",
		)).toBe(false);

		await evictDurableObject(stub, { webSockets: "hibernate" });
		host.send({
			type: "HOST_STATE",
			roomId,
			state: playbackState(
				"crunchyroll|watch/history-authority",
				"https://www.crunchyroll.com/watch/history-authority",
			),
			source: sourceDescriptor(
				"crunchyroll|watch/history-authority",
				"History Authority Episode",
				"https://www.crunchyroll.com/watch/history-authority",
			),
		});

		await guest.waitFor(
			(event) => event.type === "SOURCE_CHANGED" && event.sourceGeneration === 2,
			"restored source change",
		);
		const hostNext = await host.waitFor(
			(event) =>
				event.type === "ROOM_HISTORY_AUTHORITY" &&
				event.participantSessionId === "host-history-session" &&
				event.sourceGeneration === 2,
			"host refreshed history authority",
		);
		const guestNext = await guest.waitFor(
			(event) =>
				event.type === "ROOM_HISTORY_AUTHORITY" &&
				event.participantSessionId === "guest-history-session" &&
				event.sourceGeneration === 2,
			"guest refreshed history authority",
		);
		expect(hostNext).toMatchObject({ roomGeneration: 1, sourceGeneration: 2 });
		expect(guestNext).toMatchObject({ roomGeneration: 1, sourceGeneration: 2 });

		const hostReconnect = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-history-session", userId: "host-user",
		});
		await expect(
			hostReconnect.waitFor(
				(event) =>
					event.type === "ROOM_HISTORY_AUTHORITY" &&
					event.participantSessionId === "host-history-session" &&
					event.sourceGeneration === 2,
				"same-session reconnect history authority",
			),
		).resolves.toMatchObject({ roomGeneration: 1, sourceGeneration: 2 });

		host.close();
		hostReconnect.close();
		guest.close();
	});

	it("never issues history authority without a participant session id", async () => {
		const roomId = `runtime-history-no-session-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const host = await openRoomSocket(stub, {
			roomId, role: "host", userId: "host-user",
		});
		host.send({
			type: "JOIN",
			roomId,
			participant: participant("host-user", "host"),
			videoFingerprint: "runtime-initial",
		});
		await host.waitFor((event) => event.type === "ROOM_SNAPSHOT", "sessionless snapshot");
		await sleep(50);
		expect(host.hasEvent((event) => event.type === "ROOM_HISTORY_AUTHORITY")).toBe(false);
		host.close();
	});

	it("does not issue or refresh history authority after room ending begins", async () => {
		const roomId = `runtime-history-ending-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-ending-session", userId: "host-user",
		});
		await host.waitFor(
			(event) => event.type === "ROOM_HISTORY_AUTHORITY" && event.sourceGeneration === 1,
			"initial history authority",
		);

		await runInDurableObject(stub, async (_instance, state) => {
			await state.storage.put(ROOM_LIFECYCLE_META_KEY, {
				schemaVersion: 1,
				status: "ended",
				endedAt: 1_000,
				reason: "host_ended",
			});
		});

		host.send({
			type: "HOST_STATE",
			roomId,
			state: playbackState(
				"crunchyroll|watch/ending-history",
				"https://www.crunchyroll.com/watch/ending-history",
			),
			source: sourceDescriptor(
				"crunchyroll|watch/ending-history",
				"Ending History Episode",
				"https://www.crunchyroll.com/watch/ending-history",
			),
		});
		await sleep(75);
		expect(host.hasEvent(
			(event) => event.type === "ROOM_HISTORY_AUTHORITY" && event.sourceGeneration === 2,
		)).toBe(false);
		host.close();
	});

	it("persists one four-hour alarm when the last joined participant leaves, even with a pre-JOIN socket", async () => {
		const roomId = `runtime-empty-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-session", userId: "host-user",
		});
		const preJoin = await openRoomSocket(stub, {
			roomId, role: "member", userId: "prejoin-user",
		});
		await host.waitFor((event) => event.type === "ROOM_SNAPSHOT", "host snapshot");

		host.close();
		const empty = await waitForRoomRuntime(
			stub,
			(value) => value.lifecycle?.status === "empty" && value.alarm !== null,
			"empty lifecycle and alarm",
		);
		expect(empty.lifecycle).toMatchObject({ schemaVersion: 1, status: "empty" });
		const emptySince = empty.lifecycle?.emptySince;
		expect(typeof emptySince).toBe("number");
		if (typeof emptySince !== "number") throw new Error("Expected emptySince");
		expect(empty.lifecycle?.alarmAt).toBe(emptySince + EMPTY_ROOM_TIMEOUT_MS);
		expect(empty.alarm).toBe(emptySince + EMPTY_ROOM_TIMEOUT_MS);

		preJoin.close();
		await sleep(50);
		expect(await readRoomRuntime(stub)).toEqual(empty);
	});

	it("activates synchronously on authenticated rejoin and ignores a stale alarm", async () => {
		const roomId = `runtime-empty-rejoin-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-session", userId: "host-user",
		});
		await host.waitFor((event) => event.type === "ROOM_SNAPSHOT", "host snapshot");
		host.close();
		await waitForRoomRuntime(
			stub,
			(value) => value.lifecycle?.status === "empty" && value.alarm !== null,
			"empty lifecycle",
		);

		const guest = await connectRoomClient(stub, {
			roomId, role: "member", sessionId: "guest-session", userId: "guest-user",
		});
		await guest.waitFor((event) => event.type === "ROOM_SNAPSHOT", "rejoin snapshot");
		const active = await waitForRoomRuntime(
			stub,
			(value) => value.lifecycle?.status === "active" && value.alarm === null,
			"active lifecycle and cancelled alarm",
		);
		expect(active.lifecycle).toMatchObject({ schemaVersion: 1, status: "active" });

		const callbackFetch = vi.fn(async () =>
			Response.json({ ok: true, usageFinalized: true }),
		);
		vi.stubGlobal("fetch", callbackFetch);
		await runInDurableObject(stub, async (_instance, state) => {
			await state.storage.setAlarm(Date.now() + 60_000);
		});
		expect(await runDurableObjectAlarm(stub)).toBe(true);
		expect(callbackFetch).not.toHaveBeenCalled();
		expect(await readRoomRuntime(stub)).toMatchObject({
			alarm: null,
			lifecycle: { schemaVersion: 1, status: "active" },
			tombstone: null,
		});
		guest.close();
	});

	it("cancels a stale empty alarm when a joined participant is still present", async () => {
		const roomId = `runtime-empty-stale-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-session", userId: "host-user",
		});
		await host.waitFor((event) => event.type === "ROOM_SNAPSHOT", "host snapshot");
		await makeEmptyAlarmDue(stub);

		const callbackFetch = vi.fn(async () =>
			Response.json({ ok: true, usageFinalized: true }),
		);
		vi.stubGlobal("fetch", callbackFetch);
		expect(await runDurableObjectAlarm(stub)).toBe(true);
		expect(callbackFetch).not.toHaveBeenCalled();
		expect(await readRoomRuntime(stub)).toMatchObject({
			alarm: null,
			lifecycle: { schemaVersion: 1, status: "active" },
			tombstone: null,
		});

		host.close();
	});

	it("persists a retry outbox, rejects rejoin while ending, and reuses the callback identity", async () => {
		const roomId = `runtime-empty-retry-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-session", userId: "host-user",
		});
		const preJoin = await openRoomSocket(stub, {
			roomId, role: "member", userId: "prejoin-user",
		});
		await host.waitFor((event) => event.type === "ROOM_SNAPSHOT", "host snapshot");
		host.close();
		await waitForRoomRuntime(
			stub,
			(value) => value.lifecycle?.status === "empty" && value.alarm !== null,
			"empty lifecycle",
		);
		const dueEmpty = await makeEmptyAlarmDue(stub);
		const emptySince = dueEmpty.lifecycle?.emptySince;
		if (typeof emptySince !== "number") throw new Error("Expected emptySince");
		const expectedEndedAt = emptySince + EMPTY_ROOM_TIMEOUT_MS;
		const expectedEventId = await createEmptyRoomEndEventId(roomId, emptySince);
		expect(expectedEventId).not.toContain(roomId);

		let callbackAttempt = 0;
		const callbackFetch = vi.fn(async (
			_input: RequestInfo | URL,
			_init?: RequestInit,
		) => {
			callbackAttempt += 1;
			return callbackAttempt === 1
				? Response.json({ error: "temporary" }, { status: 503 })
				: Response.json({
					ok: true,
					eventId: expectedEventId,
					usageFinalized: true,
				});
		});
		vi.stubGlobal("fetch", callbackFetch);

		expect(await runDurableObjectAlarm(stub)).toBe(true);
		const ending = await readRoomRuntime(stub);
		expect(ending.lifecycle).toMatchObject({
			schemaVersion: 1,
			status: "ending",
			emptySince,
			endedAt: expectedEndedAt,
			eventId: expectedEventId,
			attempts: 1,
		});
		expect(ending.alarm).toBe(ending.lifecycle?.nextAttemptAt);
		expect(ending.tombstone).toBeNull();

		const token = await roomToken(roomId, "member", "late-user");
		const rejoin = await stub.fetch(
			`https://room.test/?roomToken=${encodeURIComponent(token)}`,
			{ headers: { Upgrade: "websocket" } },
		);
		expect(rejoin.status).toBe(409);

		await makeRetryAlarmDue(stub);
		expect(await runDurableObjectAlarm(stub)).toBe(true);
		await preJoin.waitFor(
			(event) => event.type === "ROOM_ENDED" && event.reason === "empty_timeout",
			"empty-timeout terminal event",
		);
		await preJoin.waitForClose(4004, "pre-JOIN terminal close");
		const terminal = await readRoomRuntime(stub);
		expect(terminal).toMatchObject({
			alarm: null,
			lifecycle: null,
			tombstone: {
				schemaVersion: 1,
				endedAt: expectedEndedAt,
				reason: "empty_timeout",
			},
		});

		expect(callbackFetch).toHaveBeenCalledTimes(2);
		for (const [input, init] of callbackFetch.mock.calls) {
			expect(String(input)).toBe(
				`https://web.internal/api/internal/rooms/${encodeURIComponent(roomId)}/ended`,
			);
			expect(new Headers(init?.headers).get("Authorization")).toBe(
				`Bearer ${INTERNAL_SECRET}`,
			);
			expect(JSON.parse(String(init?.body))).toEqual({
				endedAt: expectedEndedAt,
				eventId: expectedEventId,
				reason: "empty_timeout",
				usage: {
					day: new Date(expectedEndedAt).toISOString().slice(0, 10),
					seconds: 0,
				},
			});
		}
	});

	it("ends terminally once, closes every socket, and rejects reconnect after hibernation", async () => {
		const roomId = `runtime-ended-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-session", userId: "host-user",
		});
		const guest = await connectRoomClient(stub, {
			roomId, role: "member", sessionId: "guest-session", userId: "guest-user",
		});
		const preJoin = await openRoomSocket(stub, {
			roomId, role: "member", userId: "prejoin-user",
		});
		await host.waitFor((event) => event.type === "ROOM_SNAPSHOT", "host snapshot");
		await guest.waitFor((event) => event.type === "ROOM_SNAPSHOT", "guest snapshot");
		host.send({
			type: "P2P_SIGNAL", roomId, clientSignalId: "before-end",
			fromUserId: "host-user", senderConnectionId: "host-connection",
			signal: { kind: "renegotiate" }, toUserId: "guest-user",
		});
		await guest.waitFor(
			(event) => event.type === "P2P_SIGNAL" && event.clientSignalId === "before-end",
			"buffered signal before end",
		);

		const command = { endedAt: 1_000, reason: "host_ended" } as const;
		const unauthorized = await stub.fetch("https://room.test/internal/end", {
			method: "POST", body: JSON.stringify(command),
		});
		expect(unauthorized.status).toBe(401);

		let callbackAttempt = 0;
		const callbackFetch = vi.fn(async () => {
			callbackAttempt += 1;
			return callbackAttempt === 1
				? Response.json({ error: "temporary" }, { status: 503 })
				: Response.json({ ok: true, usageFinalized: true });
		});
		vi.stubGlobal("fetch", callbackFetch);

		const first = await endRoom(stub, command);
		expect(first.status).toBe(502);
		expect(await readRoomRuntime(stub)).toMatchObject({ tombstone: null });

		const completed = await endRoom(stub, command);
		expect(completed.status).toBe(200);
		expect(await completed.json()).toMatchObject({
			ok: true,
			alreadyEnded: false,
			webFinalized: true,
		});
		await host.waitFor(
			(event) => event.type === "ROOM_ENDED" && event.endedAt === 1_000,
			"terminal room event",
		);
		await host.waitForClose(4004, "host terminal close");
		await guest.waitForClose(4004, "guest terminal close");
		await preJoin.waitForClose(4004, "pre-JOIN terminal close");

		const repeated = await endRoom(stub, { endedAt: 2_000, reason: "quota_exhausted" });
		expect(await repeated.json()).toMatchObject({
			ok: true,
			alreadyEnded: true,
			webFinalized: true,
			endedAt: 1_000,
			reason: "host_ended",
		});
		expect(callbackFetch).toHaveBeenCalledTimes(2);
	});

	it("serializes concurrent end commands around the Web callback", async () => {
		const roomId = `runtime-end-race-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		let releaseCallback: () => void = () => {};
		const callbackGate = new Promise<void>((resolve) => {
			releaseCallback = resolve;
		});
		const callbackFetch = vi.fn(async () => {
			await callbackGate;
			return Response.json({ ok: true, usageFinalized: true });
		});
		vi.stubGlobal("fetch", callbackFetch);

		const firstPromise = endRoom(stub, { endedAt: 1_000, reason: "host_ended" });
		await vi.waitFor(() => expect(callbackFetch).toHaveBeenCalledTimes(1));
		const secondPromise = endRoom(stub, {
			endedAt: 2_000,
			reason: "quota_exhausted",
		});
		await sleep(25);
		const callbackCountWhileBlocked = callbackFetch.mock.calls.length;
		releaseCallback();

		const [first, second] = await Promise.all([firstPromise, secondPromise]);
		expect(callbackCountWhileBlocked).toBe(1);
		expect(callbackFetch).toHaveBeenCalledTimes(1);
		expect(await first.json()).toMatchObject({
			alreadyEnded: false,
			endedAt: 1_000,
			reason: "host_ended",
			webFinalized: true,
		});
		expect(await second.json()).toMatchObject({
			alreadyEnded: true,
			endedAt: 1_000,
			reason: "host_ended",
			webFinalized: true,
		});
	});

	it("does not claim that a legacy tombstone proves Web finalization", async () => {
		const roomId = `runtime-legacy-tombstone-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		await runInDurableObject(stub, (_instance, state) => {
			state.storage.sql.exec(
				"INSERT OR REPLACE INTO room_meta (key, value_json, updated_at) VALUES (?, ?, ?)",
				"room_ended",
				JSON.stringify({
					schemaVersion: 1,
					endedAt: 1_000,
					reason: "host_ended",
				}),
				1_000,
			);
		});
		await evictDurableObject(stub, { webSockets: "hibernate" });

		const repeated = await endRoom(stub, {
			endedAt: 2_000,
			reason: "quota_exhausted",
		});
		expect(await repeated.json()).toMatchObject({
			alreadyEnded: true,
			endedAt: 1_000,
			reason: "host_ended",
			webFinalized: false,
		});
	});

	it("keeps authoritative Free-room usage through hibernation and repeated end", async () => {
		const roomId = `runtime-meter-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-session", userId: "host-user",
		});
		const guest = await connectRoomClient(stub, {
			roomId, role: "member", sessionId: "guest-session", userId: "guest-user",
		});
		const guestSnapshot = await guest.waitFor(
			(event) => event.type === "ROOM_SNAPSHOT",
			"guest metered snapshot",
		);
		expect(guestSnapshot).toMatchObject({
			type: "ROOM_SNAPSHOT",
			roomUsage: { seconds: 0 },
		});

		const meterNow = Date.now();
		await runInDurableObject(stub, (_instance, state) => {
			state.storage.sql.exec(
				"INSERT OR REPLACE INTO room_meta (key, value_json, updated_at) VALUES (?, ?, ?)",
				"room_meter",
				JSON.stringify({
					schemaVersion: 1,
					accumulatedMs: 125_000,
					activeSince: meterNow - 5_000,
					day: new Date(meterNow).toISOString().slice(0, 10),
				}),
				meterNow,
			);
		});
		await evictDurableObject(stub, { webSockets: "hibernate" });
		stubSuccessfulWebFinalization();

		const first = await endRoom(stub, { endedAt: meterNow, reason: "host_ended" });
		const firstBody = (await first.json()) as {
			usage?: { day: string; seconds: number };
		};
		expect(firstBody).toMatchObject({
			ok: true,
			alreadyEnded: false,
			webFinalized: true,
		});
		expect(firstBody.usage?.day).toBe(new Date(meterNow).toISOString().slice(0, 10));
		expect(firstBody.usage?.seconds).toBeGreaterThanOrEqual(130);
		expect(firstBody.usage?.seconds).toBeLessThanOrEqual(131);
		const repeated = await endRoom(stub, {
			endedAt: meterNow + 5_000,
			reason: "quota_exhausted",
		});
		expect(await repeated.json()).toMatchObject({
			ok: true,
			alreadyEnded: true,
			webFinalized: true,
			usage: firstBody.usage,
		});

		host.close();
		guest.close();
	});

	it("rejects valid-token reconnect after the ended tombstone is persisted", async () => {
		const roomId = `runtime-ended-reconnect-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		stubSuccessfulWebFinalization();
		const ended = await endRoom(stub, { endedAt: 1_000, reason: "host_ended" });
		expect(ended.status).toBe(200);

		const token = await roomToken(roomId, "member", "reconnect-user");
		const reconnect = await stub.fetch(
			`https://room.test/?roomToken=${encodeURIComponent(token)}`,
			{ headers: { Upgrade: "websocket" } },
		);
		expect(reconnect.status).toBe(410);
	});

	it("cleans stale runtime storage again on an idempotent end retry", async () => {
		const roomId = `runtime-ended-retry-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		stubSuccessfulWebFinalization();
		const first = await endRoom(stub, { endedAt: 1_000, reason: "host_ended" });
		expect(first.status).toBe(200);
		expect(
			await runInDurableObject(stub, (_instance, state) => state.getWebSocketAutoResponse()),
		).toBeNull();

		await runInDurableObject(stub, (_instance, state) => {
			state.storage.sql.exec(
				"INSERT OR REPLACE INTO room_meta (key, value_json, updated_at) VALUES (?, ?, ?)",
				"room_state", JSON.stringify({ stale: true }), 2_000,
			);
			state.storage.sql.exec(
				"INSERT OR REPLACE INTO room_meta (key, value_json, updated_at) VALUES (?, ?, ?)",
				"next_p2p_server_seq", "99", 2_000,
			);
			state.storage.sql.exec(
				`INSERT INTO p2p_replay_meta (
					server_seq, dedupe_hash, room_generation, source_generation,
					server_received_at, signal_kind
				) VALUES (?, ?, ?, ?, ?, ?)`,
				99,
				"a".repeat(64),
				1, 1, 2_000,
				"renegotiate",
			);
		});

		const repeated = await endRoom(stub, { endedAt: 2_000, reason: "quota_exhausted" });
		expect(await repeated.json()).toMatchObject({
			ok: true, alreadyEnded: true, endedAt: 1_000, reason: "host_ended",
		});
		const persisted = await runInDurableObject(stub, (_instance, state) => ({
			keys: state.storage.sql
				.exec<{ key: string }>("SELECT key FROM room_meta ORDER BY key")
				.toArray().map((row) => row.key),
			replayCount: state.storage.sql
				.exec<{ count: number }>("SELECT COUNT(*) AS count FROM p2p_replay_meta")
				.toArray()[0]?.count,
		}));
		expect(persisted).toEqual({ keys: ["room_ended"], replayCount: 0 });
	});

	it("wakes with durable room state and requests fresh P2P negotiation instead of persisting media", async () => {
		const roomId = `runtime-hibernation-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace })
			.ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));

		const host = await connectRoomClient(stub, {
			roomId,
			role: "host",
			sessionId: "host-session",
			userId: "host-user",
		});
		const guest = await connectRoomClient(stub, {
			roomId,
			role: "member",
			sessionId: "guest-session",
			userId: "guest-user",
		});

		await host.waitFor(
			(event) => event.type === "ROOM_SNAPSHOT",
			"host snapshot",
		);
		await guest.waitFor(
			(event) => event.type === "ROOM_SNAPSHOT",
			"guest snapshot",
		);
		await host.waitFor(
			(event) =>
				event.type === "PARTICIPANT_JOINED" &&
				event.participant.id === "guest-user",
			"host sees guest",
		);

		host.send({
			type: "HOST_STATE",
			roomId,
			state: playbackState(
				"crunchyroll|watch/runtime-one",
				"https://www.crunchyroll.com/watch/runtime-one",
			),
			source: sourceDescriptor(
				"crunchyroll|watch/runtime-one",
				"Runtime Episode 1",
				"https://www.crunchyroll.com/watch/runtime-one",
			),
		});
		await guest.waitFor(
			(event) =>
				event.type === "HOST_STATE" &&
				event.state.videoFingerprint === "crunchyroll|watch/runtime-one",
			"guest receives pre-eviction host state",
		);

		host.send({
			type: "P2P_SIGNAL",
			roomId,
			clientSignalId: "before-evict",
			fromUserId: "host-user",
			senderConnectionId: "host-connection",
			signal: { kind: "renegotiate" },
			toUserId: "guest-user",
		});
		const beforeEvictSignal = await guest.waitFor(
			(event) =>
				event.type === "P2P_SIGNAL" && event.clientSignalId === "before-evict",
			"guest receives pre-eviction p2p signal",
		);
		expect(beforeEvictSignal.type).toBe("P2P_SIGNAL");
		if (beforeEvictSignal.type !== "P2P_SIGNAL") {
			throw new Error("Expected P2P_SIGNAL");
		}

		await evictDurableObject(stub, { webSockets: "hibernate" });

		guest.sendRaw("ping");
		await guest.waitForRaw(
			(message) => message === "pong",
			"auto-response pong",
		);

		host.send({
			type: "HOST_STATE",
			roomId,
			state: playbackState(
				"crunchyroll|watch/runtime-one",
				"https://www.crunchyroll.com/watch/runtime-one",
			),
			source: sourceDescriptor(
				"crunchyroll|watch/runtime-one",
				"Runtime Episode 1",
				"https://www.crunchyroll.com/watch/runtime-one",
			),
		});
		await guest.waitFor(
			(event) =>
				event.type === "HOST_STATE" &&
				event.state.videoFingerprint === "crunchyroll|watch/runtime-one",
			"guest receives post-wake host state",
		);

		host.send({ type: "CAMERA_ON", roomId, userId: "host-user" });
		const cameraSnapshot = await guest.waitFor(
			(event) =>
				event.type === "ROOM_SNAPSHOT" &&
				event.participants.some(
					(participant) =>
						participant.id === "host-user" && participant.cameraEnabled,
				),
			"guest receives post-wake camera snapshot",
		);
		expect(cameraSnapshot.type).toBe("ROOM_SNAPSHOT");
		if (cameraSnapshot.type !== "ROOM_SNAPSHOT") {
			throw new Error("Expected ROOM_SNAPSHOT");
		}
		expect(cameraSnapshot.hostState?.videoFingerprint).toBe(
			"crunchyroll|watch/runtime-one",
		);
		expect(cameraSnapshot.source?.title).toBe("Runtime Episode 1");

		host.send({ type: "CAMERA_OFF", roomId, userId: "host-user" });
		await guest.waitFor(
			(event) =>
				event.type === "ROOM_SNAPSHOT" &&
				event.participants.some(
					(participant) =>
						participant.id === "host-user" && !participant.cameraEnabled,
				),
			"guest receives post-wake camera-off snapshot",
		);

		host.send({
			type: "P2P_SIGNAL",
			roomId,
			clientSignalId: "after-evict",
			fromUserId: "host-user",
			senderConnectionId: "host-connection",
			signal: { kind: "renegotiate" },
			toUserId: "guest-user",
		});
		const afterEvictSignal = await guest.waitFor(
			(event) =>
				event.type === "P2P_SIGNAL" && event.clientSignalId === "after-evict",
			"guest receives post-wake p2p signal",
		);
		expect(afterEvictSignal.type).toBe("P2P_SIGNAL");
		if (afterEvictSignal.type !== "P2P_SIGNAL") {
			throw new Error("Expected P2P_SIGNAL");
		}
		expect(afterEvictSignal.serverSeq).toBeGreaterThan(
			beforeEvictSignal.serverSeq,
		);
		expect(afterEvictSignal.roomGeneration).toBe(cameraSnapshot.roomGeneration);
		expect(afterEvictSignal.sourceGeneration).toBe(
			cameraSnapshot.sourceGeneration,
		);
		const durableReplay = await runInDurableObject(stub, (_instance, state) => {
			const tables = state.storage.sql
				.exec<{ name: string }>(
					"SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'p2p_replay%' ORDER BY name",
				)
				.toArray()
				.map((row) => row.name);
			const rows = state.storage.sql
				.exec<Record<string, string | number>>("SELECT * FROM p2p_replay_meta ORDER BY server_seq")
				.toArray();
			return { rows, tables };
		});
		expect(durableReplay.tables).toEqual(["p2p_replay_meta"]);
		const durableReplayText = JSON.stringify(durableReplay.rows);
		for (const forbidden of [
			roomId,
			"host-user",
			"guest-user",
			"host-connection",
			"before-evict",
			"after-evict",
			"candidate",
			"sdp",
		]) {
			expect(durableReplayText).not.toContain(forbidden);
		}
		await runInDurableObject(stub, (_instance, state) => {
			// Simulate privacy-safe replay metadata aging out before the next
			// hibernation wake. The durable sequence high-water mark must still
			// force media resync because no raw signal can be replayed.
			state.storage.sql.exec("DELETE FROM p2p_replay_meta");
			state.storage.sql.exec(
				`CREATE TABLE p2p_replay (
					server_seq INTEGER PRIMARY KEY,
					dedupe_key TEXT NOT NULL,
					to_user_id TEXT NOT NULL,
					room_generation INTEGER NOT NULL,
					source_generation INTEGER NOT NULL,
					server_received_at INTEGER NOT NULL,
					event_json TEXT NOT NULL
				)`,
			);
			state.storage.sql.exec(
				`INSERT INTO p2p_replay (
					server_seq, dedupe_key, to_user_id, room_generation,
					source_generation, server_received_at, event_json
				) VALUES (?, ?, ?, ?, ?, ?, ?)`,
				999,
				"raw-room:raw-user-a:raw-user-b:raw-signal",
				"raw-user-b",
				1,
				1,
				Date.now(),
				JSON.stringify({ sdp: "raw-sdp", candidate: "raw-candidate" }),
			);
		});

		await evictDurableObject(stub, { webSockets: "hibernate" });

		const guestReconnect = await connectRoomClient(stub, {
			roomId,
			lastSeenP2PServerSeq: beforeEvictSignal.serverSeq,
			role: "member",
			sessionId: "guest-session-reconnect",
			userId: "guest-user",
		});
		const reconnectSnapshot = await guestReconnect.waitFor(
			(event) => event.type === "ROOM_SNAPSHOT",
			"guest reconnect snapshot",
		);
		expect(reconnectSnapshot).toMatchObject({
			type: "ROOM_SNAPSHOT",
			p2pResyncRequired: true,
		});
		await sleep(100);
		expect(
			guestReconnect.hasEvent(
				(event) =>
					event.type === "P2P_SIGNAL" && event.clientSignalId === "after-evict",
			),
		).toBe(false);
		const replayTablesAfterMigration = await runInDurableObject(stub, (_instance, state) =>
			state.storage.sql
				.exec<{ name: string }>(
					"SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'p2p_replay%' ORDER BY name",
				)
				.toArray()
				.map((row) => row.name),
		);
		expect(replayTablesAfterMigration).toEqual(["p2p_replay_meta"]);

		host.close();
		guest.close();
		guestReconnect.close();
	});
});

interface RoomRuntimeSnapshot {
	alarm: number | null;
	lifecycle: Record<string, unknown> | null;
	tombstone: Record<string, unknown> | null;
}

async function readRoomRuntime(stub: DurableObjectStub): Promise<RoomRuntimeSnapshot> {
	return runInDurableObject(stub, async (_instance, state) => {
		const readMeta = (key: string): Record<string, unknown> | null => {
			const row = state.storage.sql
				.exec<{ value_json: string }>("SELECT value_json FROM room_meta WHERE key = ?", key)
				.toArray()[0];
			return row ? JSON.parse(row.value_json) as Record<string, unknown> : null;
		};
		return {
			alarm: await state.storage.getAlarm(),
			lifecycle: await state.storage.get<Record<string, unknown>>(ROOM_LIFECYCLE_META_KEY) ?? null,
			tombstone: readMeta("room_ended"),
		};
	});
}

async function makeEmptyAlarmDue(stub: DurableObjectStub): Promise<RoomRuntimeSnapshot> {
	await runInDurableObject(stub, async (_instance, state) => {
		const emptySince = Date.now() - EMPTY_ROOM_TIMEOUT_MS - 1_000;
		const alarmAt = emptySince + EMPTY_ROOM_TIMEOUT_MS;
		await state.storage.transaction(async (transaction) => {
			await transaction.put(ROOM_LIFECYCLE_META_KEY, {
				schemaVersion: 1,
				status: "empty",
				emptySince,
				alarmAt,
			});
			await transaction.setAlarm(Date.now() + 60_000);
		});
	});
	return readRoomRuntime(stub);
}

async function makeRetryAlarmDue(stub: DurableObjectStub): Promise<void> {
	await runInDurableObject(stub, async (_instance, state) => {
		await state.storage.transaction(async (transaction) => {
			const lifecycle = await transaction.get<Record<string, unknown>>(ROOM_LIFECYCLE_META_KEY);
			if (!lifecycle || lifecycle.status !== "ending") {
				throw new Error("Expected ending lifecycle");
			}
			const nextAttemptAt = Date.now() - 1;
			await transaction.put(ROOM_LIFECYCLE_META_KEY, { ...lifecycle, nextAttemptAt });
			await transaction.setAlarm(Date.now() + 60_000);
		});
	});
}

async function waitForRoomRuntime(
	stub: DurableObjectStub,
	predicate: (value: RoomRuntimeSnapshot) => boolean,
	label: string,
	timeoutMs = 1_500,
): Promise<RoomRuntimeSnapshot> {
	const deadline = Date.now() + timeoutMs;
	let latest = await readRoomRuntime(stub);
	while (Date.now() < deadline) {
		if (predicate(latest)) return latest;
		await sleep(20);
		latest = await readRoomRuntime(stub);
	}
	throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(latest)}`);
}

async function endRoom(
	stub: DurableObjectStub,
	command: { endedAt: number; reason: "host_ended" | "quota_exhausted" },
): Promise<Response> {
	return stub.fetch("https://room.test/internal/end", {
		method: "POST",
		headers: { Authorization: `Bearer ${INTERNAL_SECRET}` },
		body: JSON.stringify(command),
	});
}

interface ConnectParams {
	lastSeenP2PServerSeq?: number;
	role: "host" | "member";
	roomId: string;
	sessionId: string;
	userId: string;
}

async function connectRoomClient(
	stub: DurableObjectStub,
	params: ConnectParams,
): Promise<RuntimeRoomClient> {
	const client = await openRoomSocket(stub, params);
	client.send({
		type: "JOIN",
		roomId: params.roomId,
		participant: participant(params.userId, params.role === "host" ? "host" : "viewer"),
		participantSessionId: params.sessionId,
		videoFingerprint: "runtime-initial",
		...(typeof params.lastSeenP2PServerSeq === "number"
			? { lastSeenP2PServerSeq: params.lastSeenP2PServerSeq }
			: {}),
	});
	return client;
}

async function roomToken(roomId: string, role: "host" | "member", userId: string): Promise<string> {
	return signRoomTokenForTest({
		avatarUrl: null, displayName: userId, role, roomId, sub: userId,
	}, TEST_SECRET_ENV);
}

async function openRoomSocket(
	stub: DurableObjectStub,
	params: Pick<ConnectParams, "role" | "roomId" | "userId">,
): Promise<RuntimeRoomClient> {
	const token = await roomToken(params.roomId, params.role, params.userId);
	const response = await stub.fetch(
		`https://room.test/?roomToken=${encodeURIComponent(token)}`,
		{ headers: { Upgrade: "websocket" } },
	);
	expect(response.status).toBe(101);
	const webSocket = (response as Response & { webSocket?: WebSocket })
		.webSocket;
	expect(webSocket).toBeDefined();
	if (!webSocket) {
		throw new Error("Expected WebSocket upgrade response");
	}

	const client = new RuntimeRoomClient(webSocket);
	client.accept();
	return client;
}

class RuntimeRoomClient {
	private readonly events: ServerEvent[] = [];
	private readonly rawMessages: string[] = [];
	private readonly closeCodes: number[] = [];

	constructor(private readonly webSocket: WebSocket) {}

	accept(): void {
		this.webSocket.accept();
		this.webSocket.addEventListener("message", (event) => {
			if (typeof event.data !== "string") {
				return;
			}
			this.rawMessages.push(event.data);
			try {
				const parsed = ServerEventSchema.safeParse(JSON.parse(event.data));
				if (parsed.success) {
					this.events.push(parsed.data);
				}
			} catch {
				/* raw hibernation keepalive */
			}
		});
		this.webSocket.addEventListener("close", (event) => {
			this.closeCodes.push(event.code);
		});
	}

	close(): void {
		this.webSocket.close();
	}

	send(event: unknown): void {
		this.webSocket.send(JSON.stringify(event));
	}

	sendRaw(message: string): void {
		this.webSocket.send(message);
	}

	hasEvent(predicate: (event: ServerEvent) => boolean): boolean {
		return this.events.some(predicate);
	}

	async waitFor(
		predicate: (event: ServerEvent) => boolean,
		label: string,
		timeoutMs = 3_000,
	): Promise<ServerEvent> {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			const match = this.events.find(predicate);
			if (match) {
				return match;
			}
			await sleep(20);
		}
		throw new Error(
			`Timed out waiting for ${label}. Events: ${JSON.stringify(this.events)}`,
		);
	}

	async waitForRaw(
		predicate: (message: string) => boolean,
		label: string,
		timeoutMs = 3_000,
	): Promise<string> {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			const match = this.rawMessages.find(predicate);
			if (match) {
				return match;
			}
			await sleep(20);
		}
		throw new Error(
			`Timed out waiting for ${label}. Raw: ${JSON.stringify(this.rawMessages)}`,
		);
	}

	async waitForClose(code: number, label: string, timeoutMs = 3_000): Promise<void> {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			if (this.closeCodes.includes(code)) return;
			await sleep(20);
		}
		throw new Error(`Timed out waiting for ${label}. Close codes: ${JSON.stringify(this.closeCodes)}`);
	}
}

function participant(id: string, role: Participant["role"]): Participant {
	return {
		cameraEnabled: false,
		displayName: id,
		id,
		lastSeenAt: 0,
		mediaSeat: "none",
		role,
		syncStatus: "unknown",
	};
}

function playbackState(videoFingerprint: string, sourceUrl: string) {
	return {
		hostTime: 42,
		playbackRate: 1,
		playing: true,
		sourceUrl,
		updatedAt: 1_000,
		videoFingerprint,
	};
}

function sourceDescriptor(
	videoFingerprint: string,
	title: string,
	sourceUrl: string,
) {
	return {
		canonicalUrl: sourceUrl,
		duration: 1_440,
		episodeNumber: 1,
		episodeTitle: title,
		provider: "crunchyroll" as const,
		seasonNumber: 1,
		seriesTitle: "Runtime Series",
		sourceUrl,
		title,
		videoFingerprint,
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
