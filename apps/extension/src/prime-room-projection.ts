import {
	getExpectedHostTime,
	canonicalizeRoomSourceUrl,
	type ClientEvent,
	type PlaybackState,
	type ServerEvent,
} from "@anidachi/protocol";
import type { BrowseBaseline } from "./prime-room-contract";

import { catalogContentId, supportsCatalogRoom } from "./catalog-room-routes";

type Snapshot = Extract<ServerEvent, { type: "ROOM_SNAPSHOT" }>;
type Chat = Extract<ServerEvent, { type: "REACTION" }>;

/** Fold only durable UI state. Never repeat transport signaling or playback commands. */
export class PrimeRoomProjection {
	snapshot: Snapshot | null = null;
	hostingTimeMode: "live" | "legacy" | null = null;
	readonly chat = new Map<string, Chat>();
	baseline: BrowseBaseline | null = null;
	private detachedAt: number | null = null;
	private follow: {
		receipt: string;
		target: BrowseBaseline;
		previous: BrowseBaseline | null;
	} | null = null;

	reserveFollow(ownerUserId: string, contentId: string, visit?: string, manualReturn = false) {
		const snapshot = this.snapshot;
		const state = snapshot?.hostState;
		const source = snapshot?.source;
		const self = snapshot?.participants.find((p) => p.id === ownerUserId);
		if (!source || !supportsCatalogRoom(source.provider)) return null;
		const result = canonicalizeRoomSourceUrl(source.sourceUrl, source.provider);
		if (!result.ok || catalogContentId(result.source.sourceUrl) !== contentId) return null;
		const { videoFingerprint: fingerprint, sourceUrl: url } = result.source;
		if (
			!self ||
			self.role === "host" ||
			self.connected === false ||
			!state ||
			(manualReturn
				? source.provider !== "primevideo" || state.hostSurface !== "player" || !!this.follow ||
					!snapshot?.participants.some(p => p.role === "host" && p.connected !== false)
				: !state.playing) ||
			source.sourceUrl !== url ||
			source.videoFingerprint !== fingerprint ||
			state.videoFingerprint !== fingerprint ||
			(!manualReturn && state.primePlayerVisit !== visit) ||
			(!manualReturn && this.baseline?.fingerprint === fingerprint &&
				(!visit || this.baseline.visit === visit))
		)
			return null;
		const receipt = crypto.randomUUID();
		const target = { fingerprint, visit: state.primePlayerVisit };
		this.follow = { receipt, target, previous: this.baseline };
		this.baseline = target;
		return { source, receipt };
	}

	cancelFollow(receipt: string) {
		if (
			!this.follow ||
			this.follow.receipt !== receipt ||
			this.baseline !== this.follow.target
		)
			return false;
		this.baseline = this.follow.previous;
		this.follow = null;
		return true;
	}

	setBaseline(value: BrowseBaseline | null) {
		if (
			this.follow &&
			this.baseline === this.follow.target &&
			value &&
			this.follow.target.fingerprint === value.fingerprint &&
			this.follow.target.visit === value.visit
		)
			return;
		this.follow = null;
		this.baseline = value;
	}

	detach(now = Date.now()) {
		this.detachedAt = now;
		const state = this.snapshot?.hostState;
		this.baseline ??= state
			? { fingerprint: state.videoFingerprint, visit: state.primePlayerVisit }
			: {};
	}

	sentHostState(ownerUserId: string, state: PlaybackState) {
		// The Worker echoes source changes to the host, but sends ordinary host
		// updates only to guests. Retain our last sent position on a verified source.
		const snapshot = this.snapshot;
		if (
			snapshot?.source && supportsCatalogRoom(snapshot.source.provider) &&
			snapshot.source.videoFingerprint === state.videoFingerprint &&
			snapshot.participants.some(
				(p) =>
					p.id === ownerUserId && p.role === "host" && p.connected !== false,
			)
		) {
			this.snapshot = { ...snapshot, hostState: state };
		}
	}

	pauseForCatalog(
		ownerUserId: string,
		now = Date.now(),
	): Extract<ClientEvent, { type: "HOST_STATE" }> | null {
		const snapshot = this.snapshot;
		const source = snapshot?.source,
			state = snapshot?.hostState;
		if (
			!snapshot ||
			!state ||
			(!state.playing && state.hostSurface !== "player") ||
			!source || !supportsCatalogRoom(source.provider) ||
			source.videoFingerprint !== state.videoFingerprint ||
			!snapshot.participants.some(
				(p) =>
					p.id === ownerUserId && p.role === "host" && p.connected !== false,
			)
		)
			return null;
		const hostTime = Math.min(
			source.duration ?? Infinity,
			getExpectedHostTime(state, this.detachedAt ?? now),
		);
		const paused: PlaybackState = { ...state, hostTime, playing: false, updatedAt: now };
		paused.hostSurface = "catalog";
		this.snapshot = { ...snapshot, hostState: paused };
		return {
			type: "HOST_STATE",
			roomId: snapshot.roomId,
			source,
			state: paused,
		};
	}

	consume(event: ServerEvent) {
		const snapshot = this.snapshot;
		switch (event.type) {
			case "ROOM_SNAPSHOT":
				if (
					snapshot &&
					(event.roomGeneration < snapshot.roomGeneration ||
						(event.roomGeneration === snapshot.roomGeneration &&
							event.serverSeq < snapshot.serverSeq))
				)
					return;
				if (snapshot?.roomGeneration !== event.roomGeneration || snapshot.roomId !== event.roomId)
					this.hostingTimeMode = null;
				this.snapshot = event;
				break;
			case "HOSTING_TIME":
			case "HOSTING_TIME_LEGACY":
				if (snapshot?.roomId === event.roomId && snapshot.roomGeneration === event.roomGeneration)
					this.hostingTimeMode ??= event.type === "HOSTING_TIME" ? "live" : "legacy";
				break;
			case "PARTICIPANT_JOINED":
				if (snapshot)
					this.snapshot = {
						...snapshot,
						participants: [
							...snapshot.participants.filter(
								(p) => p.id !== event.participant.id,
							),
							event.participant,
						],
					};
				break;
			case "PARTICIPANT_LEFT":
				if (snapshot)
					this.snapshot = {
						...snapshot,
						participants: snapshot.participants.filter(
							(p) =>
								p.id !== event.participant.id ||
								p.participantSessionId !==
									event.participant.participantSessionId,
						),
					};
				break;
			case "SOURCE_CHANGED":
				if (
					snapshot &&
					event.roomGeneration === snapshot.roomGeneration &&
					event.sourceGeneration >= snapshot.sourceGeneration &&
					event.serverSeq >= snapshot.serverSeq
				)
					this.snapshot = {
						...snapshot,
						sourceGeneration: event.sourceGeneration,
						serverSeq: event.serverSeq,
						hostState: event.hostState,
						source: event.source,
					};
				break;
			case "HOST_STATE":
				if (snapshot) this.snapshot = { ...snapshot, hostState: event.state };
				break;
			case "REACTION":
				if (!event.reaction.text || this.chat.has(event.reaction.id)) return;
				this.chat.set(event.reaction.id, event);
				if (this.chat.size > 80)
					this.chat.delete(this.chat.keys().next().value!);
				break;
		}
	}
}
