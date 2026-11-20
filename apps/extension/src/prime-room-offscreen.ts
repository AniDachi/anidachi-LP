import { ClientEventSchema, type ServerEvent } from "@anidachi/protocol";
import {
	RoomClient,
	ROOM_SESSION_TAKEN_OVER_CLOSE_CODE,
	type RoomConnectionStatus,
} from "./room-client";
import type { SignalingTransportReady } from "./media-types";
import { createPrimeRoomMedia } from "./prime-room-media";
import { PrimeRoomProjection } from "./prime-room-projection";
import {
	PRIME_ROOM_DOCUMENT_HANDOFF_MS,
	PRIME_ROOM_INTERNAL,
	PRIME_ROOM_PORT,
	samePrimeRoom,
	type PrimeRoomIdentity,
	type PrimeRoomCommand,
	type PrimeRoomNotification,
	type PrimeConnect,
} from "./prime-room-contract";

import type { CatalogRoomProvider } from "./catalog-room-routes";

type Ticket = {
	provider: CatalogRoomProvider;
	ticket: string;
	attempt: string;
	identity: PrimeRoomIdentity;
	documentId: string;
	resumeOnly: boolean;
	browsing: boolean;
	expiresAt: number;
};
type Owner = {
	provider: CatalogRoomProvider;
	tabId: number;
	detachTimer: ReturnType<typeof setTimeout> | null;
	identity: PrimeRoomIdentity;
	client: RoomClient;
	media: ReturnType<typeof createPrimeRoomMedia>;
	projection: PrimeRoomProjection;
	port: chrome.runtime.Port | null;
	documentId: string;
	attempt: string;
	status: RoomConnectionStatus;
	ready: SignalingTransportReady | null;
};

export function registerPrimeRoomOffscreen() {
	const owners = new Map<number, Owner>();
	const tickets = new Map<number, Ticket>();
	function detach(owner: Owner) {
		owner.port = null;
		owner.projection.detach();
		owner.media.onDetach();
		owner.detachTimer ??= setTimeout(() => {
			if (owners.get(owner.tabId) === owner && !owner.port)
				stop(owner.tabId, true);
		}, PRIME_ROOM_DOCUMENT_HANDOFF_MS);
	}
	function notify(owner: Owner, message: PrimeRoomNotification) {
		try {
			owner.port?.postMessage(message);
		} catch {
			detach(owner);
		}
	}
	function stop(tabId: number, departDetached = false) {
		const owner = owners.get(tabId);
		if (!owner) return null;
		owners.delete(tabId);
		if (owner.detachTimer !== null) clearTimeout(owner.detachTimer);
		if (departDetached && !owner.port) {
			void chrome.runtime
				.sendMessage({
					type: PRIME_ROOM_INTERNAL,
					action: "depart",
					tabId,
					identity: owner.identity,
				})
				.catch(() => undefined);
		}
		owner.media.close();
		owner.client.close();
		owner.port?.disconnect();
		return owner.identity;
	}
	function expose(owner: Owner) {
		notify(owner, { kind: "connection", id: owner.client.senderConnectionId });
		notify(owner, { kind: "status", status: owner.status });
		const snapshot = owner.projection.snapshot;
		if (owner.client.media)
			notify(owner, {
				kind: "media-state",
				state: owner.client.media.rebindState(),
			});
		if (snapshot) notify(owner, { kind: "event", event: snapshot });
		if (owner.client.media?.snapshot)
			notify(owner, { kind: "event", event: owner.client.media.snapshot });
		notify(owner, {
			kind: "authority",
			authority: owner.client.historyAuthority,
		});
		if (owner.ready) notify(owner, { kind: "ready", ready: owner.ready });
		for (const event of owner.projection.chat.values())
			notify(owner, { kind: "chat-history", reaction: event.reaction });
		owner.media.onAttach();
	}
	function start(
		tabId: number,
		port: chrome.runtime.Port,
		ticket: Ticket,
		options: PrimeConnect,
	) {
		const identity = ticket.identity;
		const client = new RoomClient();
		const owner: Owner = {
			provider: ticket.provider,
			tabId,
			detachTimer: null,
			identity,
			client,
			port,
			documentId: ticket.documentId,
			attempt: ticket.attempt,
			status: "connecting",
			ready: null,
			projection: new PrimeRoomProjection(),
			media: createPrimeRoomMedia(
				client,
				options.participant,
				(value) => notify(owner, { kind: "media", value }),
				{
					tabId,
					provider: ticket.provider,
					roomId: identity.roomId,
					roomToken: options.roomToken,
					participantSessionId: identity.participantSessionId,
				},
			),
		};
		owners.set(tabId, owner);
		client.connect({
			...options,
			acknowledgeAdmissionHandoff: (handoff) =>
				chrome.runtime.sendMessage({
					type: PRIME_ROOM_INTERNAL,
					action: "ack",
					tabId,
					handoff,
				}),
			onEvent(event: ServerEvent) {
				if (
					owners.get(tabId) !== owner ||
					("roomId" in event && event.roomId !== identity.roomId)
				)
					return;
				const lostMembership =
					(event.type === "ROOM_SNAPSHOT" &&
						!event.participants.some(
							(p) =>
								p.id === identity.ownerUserId &&
								p.participantSessionId === identity.participantSessionId &&
								p.connected !== false,
						)) ||
					(event.type === "PARTICIPANT_JOINED" &&
						event.participant.id === identity.ownerUserId &&
						(event.participant.participantSessionId !==
							identity.participantSessionId ||
							event.participant.connected === false)) ||
					(event.type === "PARTICIPANT_LEFT" &&
						event.participant.id === identity.ownerUserId &&
						event.participant.participantSessionId ===
							identity.participantSessionId);
				if (lostMembership) {
					notify(owner, {
						kind: "terminal",
						code: ROOM_SESSION_TAKEN_OVER_CLOSE_CODE,
					});
					stop(tabId, true);
					return;
				}
				owner.projection.consume(event);
				owner.media.onEvent(event);
				const mediaState = [
					"ROOM_MEDIA_SNAPSHOT",
					"MEDIA_INTENT_ACK",
					"MEDIA_INTENT_ERROR",
					"MEDIA_SEAT_RESULT",
				].includes(event.type)
					? client.media?.rebindState()
					: undefined;
				notify(owner, { kind: "event", event, mediaState });
				if (event.type === "ROOM_ENDED") stop(tabId, true);
			},
			onStatus(status) {
				if (owners.get(tabId) !== owner) return;
				owner.status = status;
				notify(owner, { kind: "connection", id: client.senderConnectionId });
				notify(owner, { kind: "status", status });
				owner.media.onStatus(status);
				if (status === "error" || status === "closed") stop(tabId, true);
			},
			onHistoryAuthority(authority) {
				notify(owner, { kind: "authority", authority });
			},
			onTerminalClose(code) {
				notify(owner, { kind: "terminal", code });
				stop(tabId, true);
			},
			onTransportReady(ready) {
				owner.ready = ready;
				owner.media.onTransportReady(ready);
				notify(owner, { kind: "ready", ready });
			},
		});
		owner.media.onAttach();
	}

	chrome.runtime.onMessage.addListener((message, sender, respond) => {
		const workerUrl = new URL("background.js", location.href).href;
		if (
			message?.type !== PRIME_ROOM_INTERNAL ||
			sender.id !== chrome.runtime.id ||
			sender.tab ||
			sender.documentId ||
			sender.url !== workerUrl
		)
			return false;
		const tabId = message.tabId;
		const owner = owners.get(tabId);
		const live =
			!!owner &&
			owner.status === "connected" &&
			!!owner.ready &&
			(!message.provider || message.provider === owner.provider) &&
			samePrimeRoom(owner.identity, message.identity);
		switch (message.action) {
			case "lookup":
				respond(live ? { browsingBaseline: owner.projection.baseline } : null);
				break;
			case "authorize":
				if ((!owner || owner.provider === message.provider) && (!message.resumeOnly || live)) {
					tickets.set(tabId, {
						provider: message.provider,
						identity: message.identity,
						documentId: message.documentId,
						ticket: message.ticket,
						attempt: message.attempt,
						resumeOnly: message.resumeOnly,
						browsing: message.browsing,
						expiresAt: Date.now() + 10_000,
					});
					respond(true);
				} else respond(false);
				break;
			case "follow":
				respond(
					live && owner.port && owner.documentId === message.documentId
						? owner.projection.reserveFollow(
								owner.identity.ownerUserId,
								message.contentId,
								message.visit,
							)
						: null,
				);
				break;
			case "cancel-follow":
				respond(live && owner.projection.cancelFollow(message.receipt));
				break;
			case "retire-unattached": {
				const ticket = tickets.get(tabId);
				if (
					(owner && !samePrimeRoom(owner.identity, message.identity)) ||
					(owner?.port && owner.documentId !== message.documentId) ||
					(ticket &&
						(!owner || ticket.documentId !== message.documentId || !samePrimeRoom(ticket.identity, message.identity)) &&
						ticket.expiresAt >= Date.now())
				) {
					respond(false);
					break;
				}
				tickets.delete(tabId);
				stop(tabId);
				respond(true);
				break;
			}
			case "active-player":
				respond(live && owner.port ? owner.documentId : null);
				break;
			case "document":
				respond(owner?.port ? owner.documentId : null);
				break;
			case "cancel-attach": {
				const ticket = tickets.get(tabId);
				const pending =
					ticket &&
					ticket.attempt === message.attempt &&
					ticket.documentId === message.documentId;
				const active =
					owner &&
					owner.attempt === message.attempt &&
					owner.documentId === message.documentId;
				if (pending) tickets.delete(tabId);
				if (
					(pending || active) &&
					owner &&
					samePrimeRoom(owner.identity, message.identity)
				)
					stop(tabId);
				respond(true);
				break;
			}
			case "stop":
				if (message.keepProvider && (owner?.provider ?? tickets.get(tabId)?.provider) === message.keepProvider) {
					respond(null);
					break;
				}
				if (
					!message.identity ||
					samePrimeRoom(tickets.get(tabId)?.identity ?? null, message.identity)
				)
					tickets.delete(tabId);
				respond(
					owner &&
						(!message.identity ||
							samePrimeRoom(owner.identity, message.identity))
						? stop(tabId)
						: null,
				);
				break;
			case "stop-all":
				tickets.clear();
				for (const tab of owners.keys()) stop(tab);
				respond(true);
				break;
			default:
				return false;
		}
		return false;
	});

	chrome.runtime.onConnect.addListener((port) => {
		const sender = port.sender;
		const tabId = sender?.tab?.id;
		if (
			port.name !== PRIME_ROOM_PORT ||
			sender?.id !== chrome.runtime.id ||
			sender.frameId !== 0 ||
			!sender.documentId ||
			tabId === undefined
		)
			return;
		port.onDisconnect.addListener(() => {
			const owner = owners.get(tabId);
			if (owner?.port === port) detach(owner);
		});
		port.onMessage.addListener((message: PrimeRoomCommand) => {
			const owner = owners.get(tabId);
			if (message.kind === "connect") {
				const ticket = tickets.get(tabId);
				const { options } = message;
				if (
					!ticket ||
					ticket.ticket !== message.ticket ||
					ticket.documentId !== sender.documentId ||
					ticket.expiresAt < Date.now() ||
					!samePrimeRoom(ticket.identity, {
						roomId: options.roomId,
						ownerUserId: options.participant.id,
						participantSessionId: options.participantSessionId,
					})
				) {
					port.disconnect();
					return;
				}
				tickets.delete(tabId);
				if (owner && owner.provider === ticket.provider && samePrimeRoom(owner.identity, ticket.identity)) {
					const previous = owner.port;
					if (previous && previous !== port) detach(owner);
					if (ticket.browsing && ticket.documentId !== owner.documentId) {
						const pause = owner.projection.pauseForCatalog(
							owner.identity.ownerUserId,
						);
						if (pause) owner.client.send(pause);
					}
					if (owner.detachTimer !== null) clearTimeout(owner.detachTimer);
					owner.detachTimer = null;
					owner.port = port;
					owner.documentId = ticket.documentId;
					owner.attempt = ticket.attempt;
					if (options.admissionHandoff?.tabId === tabId)
						owner.client.rebindAdmissionHandoff(options.admissionHandoff);
					if (previous !== port) previous?.disconnect();
					expose(owner);
				} else if (!ticket.resumeOnly && options.roomToken) {
					stop(tabId);
					try {
						start(tabId, port, ticket, options);
					} catch {
						stop(tabId);
						port.disconnect();
					}
				} else port.disconnect();
				return;
			}
			if (!owner || owner.port !== port) return;
			switch (message.kind) {
				case "close":
					stop(tabId);
					break;
				case "baseline":
					owner.projection.setBaseline(message.value);
					break;
				case "media":
					owner.media.onCommand(message.value);
					break;
				case "send": {
					const parsed = ClientEventSchema.safeParse(message.event);
					if (
						!parsed.success ||
						parsed.data.type === "JOIN" ||
						parsed.data.roomId !== owner.identity.roomId
					)
						return;
					const event = parsed.data;
					if (
						event.type === "SET_MEDIA_INTENT" &&
						!owner.client.media?.acceptForwardedIntent(event)
					)
						return;
					if (event.type === "SET_MEDIA_SEAT")
						owner.client.media?.trackForwardedSeat(event);
					const sent = owner.client.send(event);
					if (sent === "sent" && event.type === "HOST_STATE")
						owner.projection.sentHostState(
							owner.identity.ownerUserId,
							event.state,
						);
					if (event.type === "SET_MEDIA_INTENT")
						owner.media.onCommand({ type: "reconcile" });
					break;
				}
			}
		});
	});
}
