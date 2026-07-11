import { evictDurableObject, reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import {
	type Participant,
	type ServerEvent,
	ServerEventSchema,
} from "@anidachi/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { signRoomTokenForTest } from "../../src/auth";

const TEST_SECRET_ENV = { ANIDACHI_JWT_SECRET: "anidachi-runtime-test-secret" };
const INTERNAL_SECRET = "anidachi-runtime-internal-secret";

afterEach(async () => {
	await reset();
});

describe("RoomDurableObject WebSocket hibernation", () => {
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

		const first = await endRoom(stub, command);
		expect(first.status).toBe(200);
		expect(await first.json()).toMatchObject({ ok: true, alreadyEnded: false });
		await host.waitFor(
			(event) => event.type === "ROOM_ENDED" && event.endedAt === 1_000,
			"terminal room event",
		);
		await host.waitForClose(4004, "host terminal close");
		await guest.waitForClose(4004, "guest terminal close");
		await preJoin.waitForClose(4004, "pre-JOIN terminal close");

		const repeated = await endRoom(stub, { endedAt: 2_000, reason: "quota_exhausted" });
		expect(await repeated.json()).toMatchObject({
			ok: true, alreadyEnded: true, endedAt: 1_000, reason: "host_ended",
		});
	});

	it("rejects valid-token reconnect after the ended tombstone is persisted", async () => {
		const roomId = `runtime-ended-reconnect-${crypto.randomUUID()}`;
		const roomNamespace = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
		const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
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
				`INSERT INTO p2p_replay (
					server_seq, dedupe_key, to_user_id, room_generation,
					source_generation, server_received_at, event_json
				) VALUES (?, ?, ?, ?, ?, ?, ?)`,
				99, "stale", "guest-user", 1, 1, 2_000, "{}",
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
				.exec<{ count: number }>("SELECT COUNT(*) AS count FROM p2p_replay")
				.toArray()[0]?.count,
		}));
		expect(persisted).toEqual({ keys: ["room_ended"], replayCount: 0 });
	});

	it("wakes from hibernation with participants, host state, camera state, and P2P replay intact", async () => {
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
				"crunchyroll|runtime|s1|e1",
				"https://www.crunchyroll.com/watch/runtime-one",
			),
			source: sourceDescriptor(
				"crunchyroll|runtime|s1|e1",
				"Runtime Episode 1",
				"https://www.crunchyroll.com/watch/runtime-one",
			),
		});
		await guest.waitFor(
			(event) =>
				event.type === "HOST_STATE" &&
				event.state.videoFingerprint === "crunchyroll|runtime|s1|e1",
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
				"crunchyroll|runtime|s1|e1",
				"https://www.crunchyroll.com/watch/runtime-one",
			),
			source: sourceDescriptor(
				"crunchyroll|runtime|s1|e1",
				"Runtime Episode 1",
				"https://www.crunchyroll.com/watch/runtime-one",
			),
		});
		await guest.waitFor(
			(event) =>
				event.type === "HOST_STATE" &&
				event.state.videoFingerprint === "crunchyroll|runtime|s1|e1",
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
			"crunchyroll|runtime|s1|e1",
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

		await evictDurableObject(stub, { webSockets: "hibernate" });

		const guestReconnect = await connectRoomClient(stub, {
			roomId,
			lastSeenP2PServerSeq: beforeEvictSignal.serverSeq,
			role: "member",
			sessionId: "guest-session-reconnect",
			userId: "guest-user",
		});
		await guestReconnect.waitFor(
			(event) => event.type === "ROOM_SNAPSHOT",
			"guest reconnect snapshot",
		);
		const replayedSignal = await guestReconnect.waitFor(
			(event) =>
				event.type === "P2P_SIGNAL" && event.clientSignalId === "after-evict",
			"guest replay after second wake",
		);
		expect(replayedSignal).toMatchObject({
			type: "P2P_SIGNAL",
			clientSignalId: "after-evict",
			serverSeq: afterEvictSignal.serverSeq,
		});

		host.close();
		guest.close();
		guestReconnect.close();
	});
});

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
