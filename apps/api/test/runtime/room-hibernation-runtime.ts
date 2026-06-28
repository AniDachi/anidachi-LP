import { evictDurableObject, reset } from "cloudflare:test";
import { env } from "cloudflare:workers";
import {
	type Participant,
	type ServerEvent,
	ServerEventSchema,
} from "@anidachi/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { signRoomTokenForTest } from "../../src/auth";

const TEST_SECRET_ENV = { ANIDACHI_JWT_SECRET: "anidachi-runtime-test-secret" };

afterEach(async () => {
	await reset();
});

describe("RoomDurableObject WebSocket hibernation", () => {
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
	const token = await signRoomTokenForTest(
		{
			avatarUrl: null,
			displayName: params.userId,
			role: params.role,
			roomId: params.roomId,
			sub: params.userId,
		},
		TEST_SECRET_ENV,
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
	client.send({
		type: "JOIN",
		roomId: params.roomId,
		participant: participant(
			params.userId,
			params.role === "host" ? "host" : "viewer",
		),
		participantSessionId: params.sessionId,
		videoFingerprint: "runtime-initial",
		...(typeof params.lastSeenP2PServerSeq === "number"
			? { lastSeenP2PServerSeq: params.lastSeenP2PServerSeq }
			: {}),
	});
	return client;
}

class RuntimeRoomClient {
	private readonly events: ServerEvent[] = [];
	private readonly rawMessages: string[] = [];

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
}

function participant(id: string, role: Participant["role"]): Participant {
	return {
		cameraEnabled: false,
		displayName: id,
		id,
		lastSeenAt: 0,
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
