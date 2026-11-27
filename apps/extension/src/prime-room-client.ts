import {
	ClientEventSchema,
	type ClientEvent,
	type RoomHistoryAuthority,
} from "@anidachi/protocol";
import { parseRoomSessionRecord } from "./room-session-storage";
import {
	RoomClient,
	ROOM_ENDED_CLOSE_CODE,
	type RoomClientOptions,
	type RoomConnectionStatus,
} from "./room-client";
import { RoomMediaSession } from "./room-media-session";
import type { RoomSendDisposition } from "./media-types";
import {
	PRIME_ROOM_PORT,
	PRIME_ROOM_UI,
	samePrimeRoom,
	type BrowseBaseline,
	type LivePrimeRoomSession,
	type PrimeRoomCommand,
	type PrimeRoomIdentity,
	type PrimeRoomNotification,
} from "./prime-room-contract";

export async function getLivePrimeRoomSession(): Promise<LivePrimeRoomSession | null> {
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const result = await chrome.runtime.sendMessage({
				type: PRIME_ROOM_UI,
				action: "lookup",
			});
			if (result !== undefined && !result?.retryable) {
				const record = parseRoomSessionRecord(result);
				return record
					? {
							...record,
							browsingBaseline: result.browsingBaseline ?? null,
							privilegedRoomAuthority: result.privilegedRoomAuthority ?? null,
						}
					: null;
			}
		} catch {
			/* The MV3 worker can restart while the document is loading. */
		}
		if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 100));
	}
	return null;
}

export async function hasLivePrimeRoomSession(
	identity: PrimeRoomIdentity,
): Promise<boolean> {
	return samePrimeRoom(await getLivePrimeRoomSession(), identity);
}

/** If restoring the UI fails, release only the owner left without a newer document. */
export async function retireUnattachedPrimeRoom(
	identity: PrimeRoomIdentity,
): Promise<boolean> {
	const nonce = crypto.randomUUID();
	const confirmActive = (
		message: { type?: string; nonce?: string },
		sender: chrome.runtime.MessageSender,
		reply: (value: boolean) => void,
	) => {
		if (
			sender.id === chrome.runtime.id &&
			!sender.tab &&
			message?.type === "ANIDACHI_PRIME_CURRENT_DOCUMENT" &&
			message.nonce === nonce
		)
			reply(true);
	};
	chrome.runtime.onMessage.addListener(confirmActive);
	try {
		return (
			(await chrome.runtime.sendMessage({
				type: PRIME_ROOM_UI,
				action: "retire-unattached",
				identity,
				nonce,
			})) === true
		);
	} catch {
		return false;
	} finally {
		chrome.runtime.onMessage.removeListener(confirmActive);
	}
}

/** The page owns only its attachment. The offscreen document owns the socket. */
export class PrimeRoomClient extends RoomClient {
	private port: chrome.runtime.Port | null = null;
	private attachment = 0;
	private status: RoomConnectionStatus = "idle";
	private physicalConnectionId = "";
	private activeDocumentProbe: (() => void) | null = null;
	private lastBaseline: BrowseBaseline | null | undefined;
	private pendingAttach: {
		identity: PrimeRoomIdentity;
		attempt: string;
	} | null = null;
	private authority: RoomHistoryAuthority | null = null;
	private readonly mediaListeners = new Set<(value: unknown) => void>();
	override get senderConnectionId() {
		return this.physicalConnectionId;
	}
	override get historyAuthority() {
		return this.authority;
	}

	override connect(options: RoomClientOptions): void {
		this.detach();
		const attachment = this.attachment;
		const {
			onEvent,
			onRestoredChat,
			onRestoredHostingTime,
			onHistoryAuthority,
			onStatus,
			onTransportReady,
			onTerminalClose,
			acknowledgeAdmissionHandoff: _ack,
			...wire
		} = options;
		this.media = new RoomMediaSession(
			options.roomId,
			options.participantSessionId,
		);
		const identity = {
			roomId: options.roomId,
			participantSessionId: options.participantSessionId,
			ownerUserId: options.participant.id,
		};
		const attempt = crypto.randomUUID();
		this.pendingAttach = { identity, attempt };
		this.status = "connecting";
		onStatus("connecting");
		void (async () => {
			const ticket = await chrome.runtime.sendMessage({
				type: PRIME_ROOM_UI,
				action: "prepare",
				identity,
				attempt,
				resumeOnly: !options.roomToken,
			});
			if (this.attachment !== attachment) return;
			if (typeof ticket !== "string") {
				if (!options.roomToken) onTerminalClose?.(ROOM_ENDED_CLOSE_CODE);
				throw new Error("Prime room attachment expired");
			}
			const port = chrome.runtime.connect({ name: PRIME_ROOM_PORT });
			this.port = port;
			const playerPath = location.origin + location.pathname;
			const confirmPlayerDocument = (
				message: { type?: string; url?: string },
				sender: chrome.runtime.MessageSender,
				reply: (value: boolean) => void,
			) => {
				if (
					message?.type !== "ANIDACHI_PRIME_CONFIRMED_DOCUMENT" ||
					sender.tab ||
					sender.id !== chrome.runtime.id
				)
					return;
				reply(
					!!options.roomToken &&
						this.port === port &&
						location.href === message.url &&
						location.origin + location.pathname === playerPath,
				);
			};
			chrome.runtime.onMessage.addListener(confirmPlayerDocument);
			this.activeDocumentProbe = () =>
				chrome.runtime.onMessage.removeListener(confirmPlayerDocument);
			port.onMessage.addListener((message: PrimeRoomNotification) => {
				if (this.port !== port) return;
				switch (message.kind) {
					case "connection":
						this.pendingAttach = null;
						this.physicalConnectionId = message.id;
						break;
					case "media-state":
						this.media?.restoreRebindState(message.state);
						break;
					case "chat-history":
						onRestoredChat?.(message.reaction);
						break;
					case "hosting-time-resume":
						onRestoredHostingTime?.(message.scope);
						break;
					case "event":
						this.observeParticipants(message.event);
						this.media?.consume(message.event);
						if (message.mediaState)
							this.media?.restoreRebindState(message.mediaState);
						onEvent(message.event);
						break;
					case "authority":
						this.authority = message.authority;
						onHistoryAuthority?.(message.authority);
						break;
					case "status":
						this.status = message.status;
						onStatus(message.status);
						break;
					case "ready":
						onTransportReady?.(message.ready);
						break;
					case "terminal":
						onTerminalClose?.(message.code);
						break;
					case "media":
						for (const listener of this.mediaListeners) listener(message.value);
						break;
				}
			});
			port.onDisconnect.addListener(() => {
				if (this.port !== port) return;
				this.port = null;
				this.status = "closed";
				onStatus("closed");
			});
			port.postMessage({
				kind: "connect",
				ticket,
				options: wire,
			} satisfies PrimeRoomCommand);
		})().catch(() => {
			if (this.attachment === attachment) {
				this.status = "closed";
				onStatus("closed");
			}
		});
	}

	override send(event: ClientEvent): RoomSendDisposition {
		if (!this.port || this.status !== "connected") return "dropped";
		if (!this.post({ kind: "send", event: ClientEventSchema.parse(event) }))
			return "dropped";
		if (event.type === "SET_MEDIA_INTENT") this.media?.markIntentSent(event);
		return "sent";
	}

	sendMediaCommand(value: unknown): void {
		this.post({ kind: "media", value });
	}
	subscribeMedia(listener: (value: unknown) => void): () => void {
		this.mediaListeners.add(listener);
		return () => this.mediaListeners.delete(listener);
	}
	setBrowsingBaseline(value: BrowseBaseline | null): void {
		const last = this.lastBaseline;
		if (
			last === value ||
			(last &&
				value &&
				last.fingerprint === value.fingerprint &&
				last.visit === value.visit)
		)
			return;
		if (this.post({ kind: "baseline", value })) this.lastBaseline = value;
	}

	private post(command: PrimeRoomCommand): boolean {
		if (!this.port) return false;
		try {
			this.port.postMessage(command);
			return true;
		} catch {
			return false;
		}
	}
	override close(): void {
		if (this.pendingAttach) {
			void chrome.runtime
				.sendMessage({
					type: PRIME_ROOM_UI,
					action: "cancel-attach",
					...this.pendingAttach,
				})
				.catch(() => undefined);
		}
		if (this.post({ kind: "close" })) this.port = null; // owner closes its end after receiving the request
		this.detach();
	}
	detach(): void {
		this.attachment++;
		this.lastBaseline = undefined;
		this.pendingAttach = null;
		this.activeDocumentProbe?.();
		this.activeDocumentProbe = null;
		const port = this.port;
		this.port = null;
		port?.disconnect();
		this.status = "idle";
		this.authority = null;
	}
}
