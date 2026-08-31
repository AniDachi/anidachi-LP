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
const ROOM_SOURCE_ACKNOWLEDGED_GENERATION_KEY =
	"room_source_acknowledged_generation_v1";
const ROOM_SOURCE_PENDING_KEY = "room_source_pending_v1";
const PARTICIPANT_DISCONNECT_KEY = "participant_disconnects_v1";

function stubSuccessfulWebFinalization() {
	const callbackFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		if (String(input).endsWith("/source")) {
			const body = JSON.parse(String(init?.body)) as { sourceGeneration: number };
			return Response.json({
				ok: true,
				outcome: "persisted",
				sourceGeneration: body.sourceGeneration,
			});
		}
		return Response.json({ ok: true, usageFinalized: true });
	});
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
		stubSuccessfulWebFinalization();
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

	it("broadcasts canonical source state without waiting for serialized Web delivery", async () => {
		const roomId = `runtime-source-queue-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		let releaseFirstSource: () => void = () => {};
		const firstSourceGate = new Promise<void>((resolve) => {
			releaseFirstSource = resolve;
		});
		const sourceBodies: Array<{ sourceGeneration: number }> = [];
		const callbackFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			if (!String(input).endsWith("/source")) {
				return Response.json({ ok: true, usageFinalized: true });
			}
			const body = JSON.parse(String(init?.body)) as { sourceGeneration: number };
			sourceBodies.push(body);
			if (sourceBodies.length === 1) await firstSourceGate;
			return Response.json({
				ok: true,
				outcome: "persisted",
				sourceGeneration: body.sourceGeneration,
			});
		});
		vi.stubGlobal("fetch", callbackFetch);
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-source-session", userId: "host-user",
		});
		const guest = await connectRoomClient(stub, {
			roomId, role: "member", sessionId: "guest-source-session", userId: "guest-user",
		});

		const firstUrl = "https://youtu.be/dQw4w9WgXcQ?feature=share";
		host.send({
			type: "HOST_STATE",
			roomId,
			state: playbackState("youtube|/dQw4w9WgXcQ", firstUrl),
			source: youtubeSourceDescriptor("youtube|/dQw4w9WgXcQ", "First video", firstUrl),
		});
		const changed = await guest.waitFor(
			(event) => event.type === "SOURCE_CHANGED" && event.sourceGeneration === 2,
			"canonical source broadcast before callback",
		);
		expect(changed).toMatchObject({
			type: "SOURCE_CHANGED",
			hostState: {
				sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
				videoFingerprint: "youtube|dQw4w9WgXcQ",
			},
			source: {
				sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
				videoFingerprint: "youtube|dQw4w9WgXcQ",
				title: "First video",
			},
		});

		host.send({
			type: "HOST_STATE",
			roomId,
			state: { ...playbackState("youtube|/dQw4w9WgXcQ", firstUrl), hostTime: 84 },
			source: youtubeSourceDescriptor("youtube|/dQw4w9WgXcQ", "First video", firstUrl),
		});
		await guest.waitFor(
			(event) => event.type === "HOST_STATE" && event.state.hostTime === 84,
			"same-source playback during slow callback",
		);
		expect(sourceBodies).toHaveLength(1);

		const nextUrl = "https://youtu.be/M7lc1UVf-VE";
		host.send({
			type: "HOST_STATE",
			roomId,
			state: playbackState("youtube|/M7lc1UVf-VE", nextUrl),
			source: youtubeSourceDescriptor("youtube|/M7lc1UVf-VE", "Next video", nextUrl),
		});
		await guest.waitFor(
			(event) => event.type === "SOURCE_CHANGED" && event.sourceGeneration === 3,
			"coalesced newer source broadcast",
		);
		expect(sourceBodies).toHaveLength(1);

		releaseFirstSource();
		await waitForRoomRuntime(
			stub,
			(value) => value.pendingSource === null && sourceBodies.length === 2,
			"serialized latest source acknowledgement",
			3_000,
		);
		expect(sourceBodies.map((body) => body.sourceGeneration)).toEqual([2, 3]);

		host.close();
		guest.close();
	});

	it("rejects malicious and cross-provider source changes before runtime mutation", async () => {
		const roomId = `runtime-source-reject-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const callbackFetch = stubSuccessfulWebFinalization();
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-reject-session", userId: "host-user",
		});
		const guest = await connectRoomClient(stub, {
			roomId, role: "member", sessionId: "guest-reject-session", userId: "guest-user",
		});
		const maliciousUrl = "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ";

		host.send({
			type: "HOST_STATE",
			roomId,
			state: playbackState("youtube|dQw4w9WgXcQ", maliciousUrl),
			source: youtubeSourceDescriptor(
				"youtube|dQw4w9WgXcQ",
				"Malicious source",
				maliciousUrl,
			),
		});
		await host.waitFor(
			(event) => event.type === "ERROR" && event.code === "INVALID_SOURCE",
			"malicious source rejection",
		);
		expect(await readRoomRuntime(stub)).toMatchObject({ pendingSource: null });
		expect(callbackFetch).not.toHaveBeenCalled();
		expect(guest.hasEvent((event) => event.type === "SOURCE_CHANGED")).toBe(false);

		const youtubeUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
		host.send({
			type: "HOST_STATE",
			roomId,
			state: playbackState("youtube|dQw4w9WgXcQ", youtubeUrl),
			source: youtubeSourceDescriptor(
				"youtube|dQw4w9WgXcQ",
				"Valid source",
				youtubeUrl,
			),
		});
		await guest.waitFor(
			(event) => event.type === "SOURCE_CHANGED" && event.sourceGeneration === 2,
			"valid provider initialization",
		);
		await waitForRoomRuntime(
			stub,
			(value) => value.pendingSource === null && callbackFetch.mock.calls.length === 1,
			"valid source delivery",
		);

		const crunchyrollUrl = "https://www.crunchyroll.com/watch/G8WUNM123";
		host.send({
			type: "HOST_STATE",
			roomId,
			state: playbackState("crunchyroll|watch/G8WUNM123", crunchyrollUrl),
			source: sourceDescriptor(
				"crunchyroll|watch/G8WUNM123",
				"Cross-provider source",
				crunchyrollUrl,
			),
		});
		await host.waitFor(
			(event) => event.type === "ERROR" && event.code === "SOURCE_PROVIDER_MISMATCH",
			"cross-provider source rejection",
		);
		expect(callbackFetch).toHaveBeenCalledTimes(1);
		expect(await readRoomRuntime(stub)).toMatchObject({ pendingSource: null });

		host.close();
		guest.close();
	});

	it("retries a transient source failure after hibernation and restores it to late joiners", async () => {
		const roomId = `runtime-source-retry-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const callbackOrder: string[] = [];
		let sourceAttempt = 0;
		let releaseAlarmSource: () => void = () => {};
		const alarmSourceGate = new Promise<void>((resolve) => {
			releaseAlarmSource = resolve;
		});
		const callbackFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			if (String(input).endsWith("/source")) {
				sourceAttempt += 1;
				callbackOrder.push(`source:${sourceAttempt}`);
				const body = JSON.parse(String(init?.body)) as { sourceGeneration: number };
				if (sourceAttempt === 1) {
					return Response.json({ error: "temporary" }, { status: 503 });
				}
				if (sourceAttempt === 2) await alarmSourceGate;
				return Response.json({
					ok: true,
					outcome: "persisted",
					sourceGeneration: body.sourceGeneration,
				});
			}
			callbackOrder.push("ended");
			return Response.json({ ok: true, usageFinalized: true });
		});
		vi.stubGlobal("fetch", callbackFetch);
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-retry-session", userId: "host-user",
		});
		const guest = await connectRoomClient(stub, {
			roomId, role: "member", sessionId: "guest-retry-session", userId: "guest-user",
		});
		const sourceUrl = "https://www.crunchyroll.com/ru/watch/G8WUNM123/episode-one";
		host.send({
			type: "HOST_STATE",
			roomId,
			state: playbackState("crunchyroll|watch/G8WUNM123", sourceUrl),
			source: sourceDescriptor(
				"crunchyroll|watch/G8WUNM123",
				"Retry episode",
				sourceUrl,
			),
		});
		await host.waitFor(
			(event) => event.type === "SOURCE_CHANGED" && event.sourceGeneration === 2,
			"source initialization",
		);
		await waitForRoomRuntime(
			stub,
			(value) => value.pendingSource?.attempts === 1,
			"first failed source attempt",
		);

		await deferSourceRetry(stub);
		await evictDurableObject(stub, { webSockets: "hibernate" });
		await makeSourceRetryDue(stub);
		const alarm = runDurableObjectAlarm(stub);
		const callbackDeadline = Date.now() + 1_500;
		while (sourceAttempt < 2 && Date.now() < callbackDeadline) await sleep(10);
		expect(sourceAttempt).toBe(2);
		host.send({
			type: "HOST_STATE",
			roomId,
			state: {
				...playbackState("crunchyroll|watch/G8WUNM123", sourceUrl),
				hostTime: 84,
			},
			source: sourceDescriptor(
				"crunchyroll|watch/G8WUNM123",
				"Retry episode",
				sourceUrl,
			),
		});
		await guest.waitFor(
			(event) => event.type === "HOST_STATE" && event.state.hostTime === 84,
			"playback while alarm source callback is pending",
		);
		releaseAlarmSource();
		expect(await alarm).toBe(true);
		await waitForRoomRuntime(
			stub,
			(value) => value.pendingSource === null,
			"successful source alarm retry",
		);
		expect(callbackOrder).toEqual(["source:1", "source:2"]);

		const lateJoiner = await connectRoomClient(stub, {
			roomId, role: "member", sessionId: "late-source-session", userId: "late-user",
		});
		const snapshot = await lateJoiner.waitFor(
			(event) => event.type === "ROOM_SNAPSHOT" && event.sourceGeneration === 2,
			"late joiner restored source snapshot",
		);
		expect(snapshot).toMatchObject({
			hostState: {
				sourceUrl: "https://www.crunchyroll.com/watch/G8WUNM123",
				videoFingerprint: "crunchyroll|watch/G8WUNM123",
			},
			source: {
				sourceUrl: "https://www.crunchyroll.com/watch/G8WUNM123",
				title: "Retry episode",
			},
		});
		host.close();
		guest.close();
		lateJoiner.close();
	});

	it("force-attempts the latest source before explicit room end", async () => {
		const roomId = `runtime-source-end-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const callbackOrder: string[] = [];
		let allowSourceSuccess = false;
		const callbackFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			if (String(input).endsWith("/source")) {
				callbackOrder.push("source");
				if (!allowSourceSuccess) {
					return Response.json({ error: "temporary" }, { status: 503 });
				}
				const body = JSON.parse(String(init?.body)) as { sourceGeneration: number };
				return Response.json({
					ok: true,
					outcome: "persisted",
					sourceGeneration: body.sourceGeneration,
				});
			}
			callbackOrder.push("ended");
			return Response.json({ ok: true, usageFinalized: true });
		});
		vi.stubGlobal("fetch", callbackFetch);
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-end-source-session", userId: "host-user",
		});
		const sourceUrl = "https://www.crunchyroll.com/watch/end-source";
		host.send({
			type: "HOST_STATE",
			roomId,
			state: playbackState("crunchyroll|watch/end-source", sourceUrl),
			source: sourceDescriptor(
				"crunchyroll|watch/end-source",
				"End source episode",
				sourceUrl,
			),
		});
		await waitForRoomRuntime(
			stub,
			(value) => value.pendingSource?.attempts === 1,
			"initial source delivery failure",
		);

		const failed = await endRoom(stub, { endedAt: 2_000, reason: "host_ended" });
		expect(failed.status).toBe(502);
		expect(callbackOrder).toEqual(["source", "source"]);
		expect(await readRoomRuntime(stub)).toMatchObject({
			pendingSource: { attempts: 2 },
			tombstone: null,
		});

		allowSourceSuccess = true;
		const completed = await endRoom(stub, { endedAt: 2_000, reason: "host_ended" });
		expect(completed.status).toBe(200);
		expect(callbackOrder).toEqual(["source", "source", "source", "ended"]);
		expect(await readRoomRuntime(stub)).toMatchObject({ pendingSource: null });
		host.close();
	});

	it("repairs a live missing outbox before explicit room finalization", async () => {
		const roomId = `runtime-source-live-repair-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const callbackOrder: string[] = [];
		let sourceAttempt = 0;
		const callbackFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			if (String(input).endsWith("/source")) {
				sourceAttempt += 1;
				callbackOrder.push(`source:${sourceAttempt}`);
				if (sourceAttempt === 1) {
					return Response.json({ error: "temporary" }, { status: 503 });
				}
				const body = JSON.parse(String(init?.body)) as { sourceGeneration: number };
				return Response.json({
					ok: true,
					outcome: "persisted",
					sourceGeneration: body.sourceGeneration,
				});
			}
			callbackOrder.push("ended");
			return Response.json({ ok: true, usageFinalized: true });
		});
		vi.stubGlobal("fetch", callbackFetch);
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-live-repair", userId: "host-user",
		});
		const sourceUrl = "https://www.crunchyroll.com/watch/live-repair";
		host.send({
			type: "HOST_STATE",
			roomId,
			state: playbackState("crunchyroll|watch/live-repair", sourceUrl),
			source: sourceDescriptor(
				"crunchyroll|watch/live-repair",
				"Live repair episode",
				sourceUrl,
			),
		});
		await waitForRoomRuntime(
			stub,
			(value) => value.pendingSource?.attempts === 1,
			"failed live source callback",
		);
		await removeSourceDurabilityState(stub);

		const completed = await endRoom(stub, { endedAt: 2_000, reason: "host_ended" });

		expect(completed.status).toBe(200);
		expect(callbackOrder).toEqual(["source:1", "source:2", "ended"]);
		expect(await readRoomRuntime(stub)).toMatchObject({
			acknowledgedSourceGeneration: 2,
			pendingSource: null,
			tombstone: { endedAt: 2_000, reason: "host_ended" },
		});
		host.close();
	});

	it("repairs a missing source outbox on hibernation wake without redelivery after ack", async () => {
		const roomId = `runtime-source-wake-repair-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		let sourceAttempt = 0;
		let releaseRepairCallback: () => void = () => {};
		const repairCallbackGate = new Promise<void>((resolve) => {
			releaseRepairCallback = resolve;
		});
		const callbackFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			if (!String(input).endsWith("/source")) {
				return Response.json({ ok: true, usageFinalized: true });
			}
			sourceAttempt += 1;
			if (sourceAttempt === 1) {
				return Response.json({ error: "temporary" }, { status: 503 });
			}
			await repairCallbackGate;
			const body = JSON.parse(String(init?.body)) as { sourceGeneration: number };
			return Response.json({
				ok: true,
				outcome: "persisted",
				sourceGeneration: body.sourceGeneration,
			});
		});
		vi.stubGlobal("fetch", callbackFetch);
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-wake-repair", userId: "host-user",
		});
		const guest = await connectRoomClient(stub, {
			roomId, role: "member", sessionId: "guest-wake-repair", userId: "guest-user",
		});
		const sourceUrl = "https://www.crunchyroll.com/watch/wake-repair";
		host.send({
			type: "HOST_STATE",
			roomId,
			state: playbackState("crunchyroll|watch/wake-repair", sourceUrl),
			source: sourceDescriptor(
				"crunchyroll|watch/wake-repair",
				"Wake repair episode",
				sourceUrl,
			),
		});
		await guest.waitFor(
			(event) => event.type === "SOURCE_CHANGED" && event.sourceGeneration === 2,
			"source before simulated outbox loss",
		);
		await waitForRoomRuntime(
			stub,
			(value) => value.pendingSource?.attempts === 1,
			"failed source before hibernation",
		);
		await removeSourceDurabilityState(stub);
		await evictDurableObject(stub, { webSockets: "hibernate" });

		guest.send({ type: "PING", roomId, sentAt: 91 });
		const callbackDeadline = Date.now() + 1_500;
		while (sourceAttempt < 2 && Date.now() < callbackDeadline) await sleep(10);
		expect(sourceAttempt).toBe(2);
		await guest.waitFor(
			(event) => event.type === "PONG" && event.sentAt === 91,
			"live room while repaired callback is pending",
		);
		releaseRepairCallback();
		await waitForRoomRuntime(
			stub,
			(value) =>
				value.acknowledgedSourceGeneration === 2 &&
				value.pendingSource === null,
			"acknowledged repaired source",
		);

		await evictDurableObject(stub, { webSockets: "hibernate" });
		guest.send({ type: "PING", roomId, sentAt: 92 });
		await guest.waitFor(
			(event) => event.type === "PONG" && event.sentAt === 92,
			"acknowledged wake",
		);
		await sleep(50);
		expect(sourceAttempt).toBe(2);

		host.close();
		guest.close();
	});

	it("rejects JOIN without the required participant session id", async () => {
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
		await host.waitFor(
			(event) =>
				event.type === "ERROR" &&
				event.code === "INVALID_EVENT",
			"sessionless JOIN rejection",
		);
		expect(host.hasEvent((event) => event.type === "ROOM_HISTORY_AUTHORITY")).toBe(false);
		host.close();
	});

	it("does not issue or refresh history authority after room ending begins", async () => {
		stubSuccessfulWebFinalization();
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

	it("uses the 60-second host deadline before the four-hour empty fallback", async () => {
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
		const pendingDisconnect = empty.pendingDisconnect?.records;
		expect(Array.isArray(pendingDisconnect)).toBe(true);
		expect(pendingDisconnect).toHaveLength(1);
		expect(pendingDisconnect?.[0]).toMatchObject({
			role: "host",
			participantSessionId: "host-session",
			userId: "host-user",
		});
		expect(empty.alarm).toBe(pendingDisconnect?.[0]?.nextAttemptAt);
		expect(empty.alarm).toBeLessThan(emptySince + EMPTY_ROOM_TIMEOUT_MS);

		preJoin.close();
		await sleep(50);
		expect(await readRoomRuntime(stub)).toEqual(empty);
	});

	it("same-session host reconnect cancels its deadline and stale empty alarm", async () => {
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

		const hostReconnect = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-session", userId: "host-user",
		});
		await hostReconnect.waitFor(
			(event) => event.type === "ROOM_SNAPSHOT",
			"rejoin snapshot",
		);
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
		hostReconnect.close();
	});

	it("restores a host deadline after hibernation and ends the room while guests remain", async () => {
		const roomId = `runtime-host-disconnect-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
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
		await guest.waitFor((event) => event.type === "ROOM_SNAPSHOT", "guest snapshot");

		host.close();
		await waitForRoomRuntime(
			stub,
			(value) => value.pendingDisconnect?.records?.[0]?.userId === "host-user",
			"stored host disconnect",
		);
		await evictDurableObject(stub, { webSockets: "hibernate" });
		await makeParticipantDisconnectDue(stub, "host-user", "host-session");
		stubSuccessfulWebFinalization();
		expect(await runDurableObjectAlarm(stub)).toBe(true);

		await expect(guest.waitFor(
			(event) =>
				event.type === "ROOM_ENDED" &&
				event.reason === "host_disconnected",
			"host disconnect room end",
		)).resolves.toMatchObject({ roomId, reason: "host_disconnected" });
		expect(await readRoomRuntime(stub)).toMatchObject({
			pendingDisconnect: null,
			tombstone: { reason: "host_disconnected" },
		});
	});

	it("retries a guest release after hibernation without ending the host room", async () => {
		const roomId = `runtime-guest-disconnect-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
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
		await guest.waitFor((event) => event.type === "ROOM_SNAPSHOT", "guest snapshot");

		guest.close();
		await waitForRoomRuntime(
			stub,
			(value) => value.pendingDisconnect?.records?.[0]?.userId === "guest-user",
			"stored guest disconnect",
		);
		await evictDurableObject(stub, { webSockets: "hibernate" });

		let departureAttempts = 0;
		const callbackFetch = vi.fn(async (input: RequestInfo | URL) => {
			if (String(input).endsWith("/departed")) {
				departureAttempts += 1;
				return departureAttempts === 1
					? new Response(null, { status: 503 })
					: Response.json({ ok: true, outcome: "departed" });
			}
			return Response.json({ ok: true, usageFinalized: true });
		});
		vi.stubGlobal("fetch", callbackFetch);
		await makeParticipantDisconnectDue(stub, "guest-user", "guest-session");
		expect(await runDurableObjectAlarm(stub)).toBe(true);
		expect(departureAttempts).toBe(1);
		expect((await readRoomRuntime(stub)).pendingDisconnect).not.toBeNull();

		await makeParticipantDisconnectDue(stub, "guest-user", "guest-session");
		expect(await runDurableObjectAlarm(stub)).toBe(true);
		expect(departureAttempts).toBe(2);
		expect(await readRoomRuntime(stub)).toMatchObject({
			lifecycle: { status: "active" },
			pendingDisconnect: null,
			tombstone: null,
		});
		host.send({ type: "PING", roomId, sentAt: 404 });
		await host.waitFor(
			(event) => event.type === "PONG" && event.sentAt === 404,
			"host remains connected",
		);
		host.close();
	});

	it("rejects unauthorized and malformed exact detach commands at the DO boundary", async () => {
		stubSuccessfulWebFinalization();
		const roomId = `runtime-detach-boundary-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
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
		await guest.waitFor(
			(event) =>
				event.type === "ROOM_SNAPSHOT" &&
				event.participants.some((participant) => participant.id === "guest-user"),
			"detach boundary guest joined",
		);
		const command = {
			roomId,
			userId: "guest-user",
			participantSessionId: "guest-session",
			requestedAt: Date.now(),
		};

		const unauthorized = await stub.fetch("https://room.test/internal/detach", {
			method: "POST",
			body: JSON.stringify(command),
		});
		const malformed = await stub.fetch("https://room.test/internal/detach", {
			method: "POST",
			headers: { Authorization: `Bearer ${INTERNAL_SECRET}` },
			body: JSON.stringify({ ...command, participantSessionId: "" }),
		});

		expect(unauthorized.status).toBe(401);
		expect(await unauthorized.json()).toEqual({ error: "UNAUTHORIZED" });
		expect(malformed.status).toBe(400);
		expect(await malformed.json()).toEqual({ error: "INVALID_DETACH_COMMAND" });
		host.send({ type: "PING", roomId, sentAt: 606 });
		await host.waitFor(
			(event) => event.type === "PONG" && event.sentAt === 606,
			"room remains active after rejected detach commands",
		);
		guest.send({ type: "PING", roomId, sentAt: 607 });
		await guest.waitFor(
			(event) => event.type === "PONG" && event.sentAt === 607,
			"guest remains connected after rejected detach commands",
		);
		guest.close();
		host.close();
	});

	it("detaches an exact guest without calling the Web departure callback", async () => {
		const callbackFetch = stubSuccessfulWebFinalization();
		const roomId = `runtime-explicit-detach-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
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
			sessionId: "guest-session-1",
			userId: "guest-1",
		});
		await guest.waitFor(
			(event) =>
				event.type === "ROOM_SNAPSHOT" &&
				event.participants.some((participant) => participant.id === "guest-1"),
			"exact guest joined",
		);

		const response = await detachParticipant(stub, {
			roomId,
			userId: "guest-1",
			participantSessionId: "guest-session-1",
			requestedAt: 1_000,
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, outcome: "detached" });
		await host.waitFor(
			(event) =>
				event.type === "PARTICIPANT_LEFT" && event.participant.id === "guest-1",
			"exact guest detached",
		);
		await guest.waitForClose(1000, "exact guest socket closed");
		await sleep(50);
		expect(host.countEvents(
			(event) =>
				event.type === "PARTICIPANT_LEFT" && event.participant.id === "guest-1",
		)).toBe(1);
		expect((await readRoomRuntime(stub)).pendingDisconnect).toBeNull();
		expect(
			callbackFetch.mock.calls.filter(([input]) =>
				String(input).endsWith("/departed")
			),
		).toHaveLength(0);
		host.close();
	});

	it("returns stale for a duplicate exact guest detach", async () => {
		stubSuccessfulWebFinalization();
		const roomId = `runtime-duplicate-detach-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-session", userId: "host-user",
		});
		const guest = await connectRoomClient(stub, {
			roomId, role: "member", sessionId: "guest-session", userId: "guest-user",
		});
		await guest.waitFor(
			(event) =>
				event.type === "ROOM_SNAPSHOT" &&
				event.participants.some((participant) => participant.id === "guest-user"),
			"duplicate detach guest joined",
		);
		const command = {
			roomId,
			userId: "guest-user",
			participantSessionId: "guest-session",
			requestedAt: Date.now(),
		};

		const first = await detachParticipant(stub, command);
		expect(await first.json()).toEqual({ ok: true, outcome: "detached" });
		const duplicate = await detachParticipant(stub, command);
		expect(duplicate.status).toBe(200);
		expect(await duplicate.json()).toEqual({ ok: true, outcome: "stale" });
		host.close();
	});

	it("does not detach a winning guest for a stale participant session", async () => {
		stubSuccessfulWebFinalization();
		const roomId = `runtime-stale-detach-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-session", userId: "host-user",
		});
		const oldGuest = await connectRoomClient(stub, {
			roomId,
			role: "member",
			sessionId: "guest-session-old",
			userId: "guest-user",
		});
		const winningGuest = await connectRoomClient(stub, {
			roomId,
			role: "member",
			sessionId: "guest-session-new",
			userId: "guest-user",
		});
		await winningGuest.waitFor(
			(event) =>
				event.type === "ROOM_SNAPSHOT" &&
				event.participants.some((participant) => participant.id === "guest-user"),
			"winning guest joined",
		);

		const stale = await detachParticipant(stub, {
			roomId,
			userId: "guest-user",
			participantSessionId: "guest-session-old",
			requestedAt: Date.now(),
		});

		expect(await stale.json()).toEqual({ ok: true, outcome: "stale" });
		winningGuest.send({ type: "PING", roomId, sentAt: 77 });
		await winningGuest.waitFor(
			(event) => event.type === "PONG" && event.sentAt === 77,
			"winning guest survives stale detach",
		);
		oldGuest.close();
		winningGuest.close();
		host.close();
	});

	it("acknowledges a hibernated pending guest detach without a Web callback", async () => {
		const callbackFetch = stubSuccessfulWebFinalization();
		const roomId = `runtime-pending-detach-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-session", userId: "host-user",
		});
		const guest = await connectRoomClient(stub, {
			roomId, role: "member", sessionId: "guest-session", userId: "guest-user",
		});
		await guest.waitFor(
			(event) =>
				event.type === "ROOM_SNAPSHOT" &&
				event.participants.some((participant) => participant.id === "guest-user"),
			"pending detach guest joined",
		);

		guest.close();
		await waitForRoomRuntime(
			stub,
			(value) =>
				value.pendingDisconnect?.records?.some(
					(record) => record.participantSessionId === "guest-session",
				) === true,
			"guest pending disconnect",
		);
		await evictDurableObject(stub, { webSockets: "hibernate" });
		const pendingDetach = await detachParticipant(stub, {
			roomId,
			userId: "guest-user",
			participantSessionId: "guest-session",
			requestedAt: Date.now(),
		});

		expect(await pendingDetach.json()).toEqual({ ok: true, outcome: "detached" });
		expect((await readRoomRuntime(stub)).pendingDisconnect).toBeNull();
		expect(
			callbackFetch.mock.calls.filter(([input]) =>
				String(input).endsWith("/departed")
			),
		).toHaveLength(0);
		host.close();
	});

	it("does not recreate pending state from a detached socket's late close", async () => {
		stubSuccessfulWebFinalization();
		const roomId = `runtime-late-close-detach-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-session", userId: "host-user",
		});
		const guest = await connectRoomClient(stub, {
			roomId, role: "member", sessionId: "guest-session", userId: "guest-user",
		});
		await guest.waitFor(
			(event) =>
				event.type === "ROOM_SNAPSHOT" &&
				event.participants.some((participant) => participant.id === "guest-user"),
			"late close guest joined",
		);

		let detachedServerSocket: WebSocket | null = null;
		await runInDurableObject(stub, (_instance, state) => {
			detachedServerSocket = state.getWebSockets().find((socket) => {
				const attachment = socket.deserializeAttachment() as {
					participantSessionId?: string;
				} | null;
				return attachment?.participantSessionId === "guest-session";
			}) ?? null;
		});
		const response = await detachParticipant(stub, {
			roomId,
			userId: "guest-user",
			participantSessionId: "guest-session",
			requestedAt: Date.now(),
		});
		expect(await response.json()).toEqual({ ok: true, outcome: "detached" });
		if (!detachedServerSocket) throw new Error("Expected exact guest socket");
		await runInDurableObject(stub, async (instance) => {
			await (instance as {
				webSocketClose(
					socket: WebSocket,
					code: number,
					reason: string,
					wasClean: boolean,
				): Promise<void>;
			}).webSocketClose(detachedServerSocket!, 1000, "late close", true);
		});

		expect((await readRoomRuntime(stub)).pendingDisconnect).toBeNull();
		host.close();
	});

	it("rejects live host detach without ending or disconnecting the room", async () => {
		stubSuccessfulWebFinalization();
		const roomId = `runtime-host-detach-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-session", userId: "host-user",
		});
		await host.waitFor(
			(event) =>
				event.type === "ROOM_SNAPSHOT" &&
				event.participants.some((participant) => participant.id === "host-user"),
			"host detach room snapshot",
		);

		const hostDetach = await detachParticipant(stub, {
			roomId,
			userId: "host-user",
			participantSessionId: "host-session",
			requestedAt: Date.now(),
		});

		expect(hostDetach.status).toBe(409);
		expect(await hostDetach.json()).toEqual({ error: "HOST_DETACH_FORBIDDEN" });
		host.send({ type: "PING", roomId, sentAt: 88 });
		await host.waitFor(
			(event) => event.type === "PONG" && event.sentAt === 88,
			"host survives forbidden detach",
		);
		expect((await readRoomRuntime(stub)).tombstone).toBeNull();
		host.close();
	});

	it("rejects a hibernated pending host detach without mutating room state", async () => {
		const callbackFetch = stubSuccessfulWebFinalization();
		const roomId = `runtime-pending-host-detach-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-session", userId: "host-user",
		});
		const guest = await connectRoomClient(stub, {
			roomId, role: "member", sessionId: "guest-session", userId: "guest-user",
		});
		await guest.waitFor(
			(event) =>
				event.type === "ROOM_SNAPSHOT" &&
				event.participants.some((participant) => participant.id === "host-user"),
			"pending host detach guest snapshot",
		);

		host.close();
		await waitForRoomRuntime(
			stub,
			(value) =>
				value.pendingDisconnect?.records?.some(
					(record) => record.participantSessionId === "host-session",
				) === true,
			"host pending disconnect",
		);
		await evictDurableObject(stub, { webSockets: "hibernate" });
		const before = await readRoomRuntime(stub);
		const response = await detachParticipant(stub, {
			roomId,
			userId: "host-user",
			participantSessionId: "host-session",
			requestedAt: Date.now(),
		});
		const after = await readRoomRuntime(stub);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({ error: "HOST_DETACH_FORBIDDEN" });
		expect(after.pendingDisconnect).toEqual(before.pendingDisconnect);
		expect(after.alarm).toBe(before.alarm);
		expect(after.lifecycle).toEqual(before.lifecycle);
		expect(after.tombstone).toBeNull();
		expect(callbackFetch).not.toHaveBeenCalled();
		guest.send({ type: "PING", roomId, sentAt: 89 });
		await guest.waitFor(
			(event) => event.type === "PONG" && event.sentAt === 89,
			"guest survives pending host detach",
		);
		guest.close();
	});

	it("returns stale when detach has no exact live or pending guest", async () => {
		stubSuccessfulWebFinalization();
		const roomId = `runtime-missing-detach-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-session", userId: "host-user",
		});
		await host.waitFor(
			(event) =>
				event.type === "ROOM_SNAPSHOT" &&
				event.participants.some((participant) => participant.id === "host-user"),
			"missing detach room snapshot",
		);

		const response = await detachParticipant(stub, {
			roomId,
			userId: "missing-guest",
			participantSessionId: "missing-session",
			requestedAt: Date.now(),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, outcome: "stale" });
		expect(await readRoomRuntime(stub)).toMatchObject({
			pendingDisconnect: null,
			tombstone: null,
		});
		host.send({ type: "PING", roomId, sentAt: 90 });
		await host.waitFor(
			(event) => event.type === "PONG" && event.sentAt === 90,
			"host survives missing detach",
		);
		host.close();
	});

	it("returns stale for detach after the room has ended", async () => {
		stubSuccessfulWebFinalization();
		const roomId = `runtime-ended-detach-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const host = await connectRoomClient(stub, {
			roomId, role: "host", sessionId: "host-session", userId: "host-user",
		});
		const guest = await connectRoomClient(stub, {
			roomId, role: "member", sessionId: "guest-session", userId: "guest-user",
		});
		await guest.waitFor(
			(event) =>
				event.type === "ROOM_SNAPSHOT" &&
				event.participants.some((participant) => participant.id === "guest-user"),
			"ended detach guest snapshot",
		);
		const ended = await endRoom(stub, { endedAt: 1_000, reason: "host_ended" });
		expect(ended.status).toBe(200);
		const before = await readRoomRuntime(stub);

		const response = await detachParticipant(stub, {
			roomId,
			userId: "guest-user",
			participantSessionId: "guest-session",
			requestedAt: 2_000,
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, outcome: "stale" });
		expect(await readRoomRuntime(stub)).toEqual(before);
	});

	it("handles exact explicit guest departure before or after socket close", async () => {
		const roomId = `runtime-explicit-departure-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
		const callbackFetch = vi.fn(async (input: RequestInfo | URL) =>
			String(input).endsWith("/departed")
				? Response.json({ ok: true, outcome: "departed" })
				: Response.json({ ok: true, usageFinalized: true }));
		vi.stubGlobal("fetch", callbackFetch);
		const host = await connectRoomClient(stub, {
			roomId,
			role: "host",
			sessionId: "host-session",
			userId: "host-user",
		});
		const firstGuest = await connectRoomClient(stub, {
			roomId,
			role: "member",
			sessionId: "guest-one-session",
			userId: "guest-one",
		});
		await expect(departParticipant(stub, {
			roomId,
			userId: "guest-one",
			participantSessionId: "guest-one-session",
			requestedAt: Date.now(),
		})).resolves.toMatchObject({ ok: true, outcome: "departed" });
		await expect(departParticipant(stub, {
			roomId,
			userId: "guest-one",
			participantSessionId: "guest-one-session",
			requestedAt: Date.now(),
		})).resolves.toMatchObject({ ok: true, outcome: "stale" });

		const secondGuest = await connectRoomClient(stub, {
			roomId,
			role: "member",
			sessionId: "guest-two-session",
			userId: "guest-two",
		});
		secondGuest.close();
		await waitForRoomRuntime(
			stub,
			(value) => value.pendingDisconnect?.records?.[0]?.userId === "guest-two",
			"second guest pending close",
		);
		await expect(departParticipant(stub, {
			roomId,
			userId: "guest-two",
			participantSessionId: "guest-two-session",
			requestedAt: Date.now(),
		})).resolves.toMatchObject({ ok: true, outcome: "departed" });
		expect((await readRoomRuntime(stub)).pendingDisconnect).toBeNull();
		expect(
			callbackFetch.mock.calls.filter(([input]) => String(input).endsWith("/departed")),
		).toHaveLength(2);
		await expect(departParticipant(stub, {
			roomId,
			userId: "host-user",
			participantSessionId: "host-session",
			requestedAt: Date.now(),
		})).resolves.toMatchObject({ ok: true, outcome: "room_ended" });
		expect(await readRoomRuntime(stub)).toMatchObject({
			pendingDisconnect: null,
			tombstone: { reason: "host_disconnected" },
		});
		firstGuest.close();
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
		stubSuccessfulWebFinalization();
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
	acknowledgedSourceGeneration: number | null;
	alarm: number | null;
	lifecycle: Record<string, unknown> | null;
	pendingSource: Record<string, unknown> | null;
	pendingDisconnect: {
		records?: Array<Record<string, unknown>>;
	} | null;
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
			acknowledgedSourceGeneration:
				await state.storage.get<number>(ROOM_SOURCE_ACKNOWLEDGED_GENERATION_KEY) ?? null,
			alarm: await state.storage.getAlarm(),
			lifecycle: await state.storage.get<Record<string, unknown>>(ROOM_LIFECYCLE_META_KEY) ?? null,
			pendingSource: await state.storage.get<Record<string, unknown>>(ROOM_SOURCE_PENDING_KEY) ?? null,
			pendingDisconnect:
				await state.storage.get<{ records?: Array<Record<string, unknown>> }>(
					PARTICIPANT_DISCONNECT_KEY,
				) ?? null,
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

async function makeParticipantDisconnectDue(
	stub: DurableObjectStub,
	userId: string,
	participantSessionId: string,
): Promise<void> {
	await runInDurableObject(stub, async (_instance, state) => {
		await state.storage.transaction(async (transaction) => {
			const stored = await transaction.get<{
				schemaVersion: 1;
				records: Array<Record<string, unknown>>;
			}>(PARTICIPANT_DISCONNECT_KEY);
			if (!stored) throw new Error("Expected participant disconnect state");
			const dueAt = Date.now() - 1;
			let found = false;
			const records = stored.records.map((record) => {
				if (
					record.userId !== userId ||
					record.participantSessionId !== participantSessionId
				) return record;
				found = true;
				const disconnectedAt = dueAt - 60_000;
				return {
					...record,
					disconnectedAt,
					deadlineAt: dueAt,
					departureAt: dueAt,
					nextAttemptAt: dueAt,
				};
			});
			if (!found) throw new Error("Expected exact participant disconnect");
			await transaction.put(PARTICIPANT_DISCONNECT_KEY, {
				schemaVersion: 1,
				records,
			});
			await transaction.setAlarm(Date.now() + 60_000);
		});
	});
}

async function makeSourceRetryDue(stub: DurableObjectStub): Promise<void> {
	await runInDurableObject(stub, async (_instance, state) => {
		await state.storage.transaction(async (transaction) => {
			const pending = await transaction.get<Record<string, unknown>>(ROOM_SOURCE_PENDING_KEY);
			if (!pending) throw new Error("Expected pending room source");
			await transaction.put(ROOM_SOURCE_PENDING_KEY, {
				...pending,
				nextAttemptAt: Date.now() - 1,
			});
			await transaction.setAlarm(Date.now() + 60_000);
		});
	});
}

async function deferSourceRetry(stub: DurableObjectStub): Promise<void> {
	await runInDurableObject(stub, async (_instance, state) => {
		await state.storage.transaction(async (transaction) => {
			const pending = await transaction.get<Record<string, unknown>>(ROOM_SOURCE_PENDING_KEY);
			if (!pending) throw new Error("Expected pending room source");
			const nextAttemptAt = Date.now() + 60_000;
			await transaction.put(ROOM_SOURCE_PENDING_KEY, { ...pending, nextAttemptAt });
			await transaction.setAlarm(nextAttemptAt);
		});
	});
}

async function removeSourceDurabilityState(stub: DurableObjectStub): Promise<void> {
	await runInDurableObject(stub, async (_instance, state) => {
		await state.storage.transaction(async (transaction) => {
			await transaction.delete(ROOM_SOURCE_PENDING_KEY);
			await transaction.delete(ROOM_SOURCE_ACKNOWLEDGED_GENERATION_KEY);
			await transaction.deleteAlarm();
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

async function departParticipant(
	stub: DurableObjectStub,
	command: {
		roomId: string;
		userId: string;
		participantSessionId: string;
		requestedAt: number;
	},
): Promise<Record<string, unknown>> {
	const response = await stub.fetch("https://room.test/internal/depart", {
		method: "POST",
		headers: { Authorization: `Bearer ${INTERNAL_SECRET}` },
		body: JSON.stringify(command),
	});
	expect(response.status).toBe(200);
	return response.json<Record<string, unknown>>();
}

async function detachParticipant(
	stub: DurableObjectStub,
	command: {
		roomId: string;
		userId: string;
		participantSessionId: string;
		requestedAt: number;
	},
): Promise<Response> {
	return stub.fetch("https://room.test/internal/detach", {
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

async function roomToken(
	roomId: string,
	role: "host" | "member",
	userId: string,
	participantSessionId = `${userId}-session`,
): Promise<string> {
	return signRoomTokenForTest({
		avatarUrl: null,
		displayName: userId,
		participantSessionId,
		role,
		roomId,
		sub: userId,
	}, TEST_SECRET_ENV);
}

async function openRoomSocket(
	stub: DurableObjectStub,
	params: Pick<ConnectParams, "role" | "roomId" | "userId"> &
		Partial<Pick<ConnectParams, "sessionId">>,
): Promise<RuntimeRoomClient> {
	const token = await roomToken(
		params.roomId,
		params.role,
		params.userId,
		params.sessionId,
	);
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

	countEvents(predicate: (event: ServerEvent) => boolean): number {
		return this.events.filter(predicate).length;
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

function youtubeSourceDescriptor(
	videoFingerprint: string,
	title: string,
	sourceUrl: string,
) {
	return {
		canonicalUrl: sourceUrl,
		duration: 213,
		provider: "youtube" as const,
		sourceUrl,
		title,
		videoFingerprint,
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
