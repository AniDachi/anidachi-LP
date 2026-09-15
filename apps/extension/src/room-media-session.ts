import type {
	MediaIntent,
	ParticipantMediaState,
	RoomMediaKind,
	RoomMediaSnapshot,
	ServerEvent,
	SetMediaSeat,
} from "@anidachi/protocol";
import { shouldApplyRoomMediaSnapshot } from "@anidachi/protocol";

export interface MediaSeatControlState {
	pending: boolean;
	requestId?: string;
	error?: string;
}

/** Client intent only. Server snapshots/ACKs remain the sole grant authority. */
export class RoomMediaSession {
	snapshot: RoomMediaSnapshot | null = null;
	error: string | null = null;
	readonly seatControls = new Map<string, MediaSeatControlState>();
	private seatRequests = new Map<string, SetMediaSeat>();
	private roomGeneration: number | null = null;
	private current = new Map<RoomMediaKind, MediaIntent>();
	private accepted = new Map<RoomMediaKind, number>();
	private sequences = { camera: 0, microphone: 0 };
	private state: ParticipantMediaState | null = null;
	private sequence = -1;
	private restorationPending = true;
	private reconciled = new Map<RoomMediaKind, string>();
	constructor(
		readonly roomId: string,
		readonly participantSessionId: string,
	) {}

	/** Only the authenticated ROOM_SNAPSHOT lifecycle may change this binding. */
	bindRoomGeneration(generation: number): boolean {
		if (this.roomGeneration !== null && generation < this.roomGeneration) return false;
		if (this.roomGeneration !== null && generation > this.roomGeneration) this.reset();
		this.roomGeneration = generation;
		return true;
	}

	hasSeat(): boolean {
		return Boolean(this.state && (!("mediaSeatGranted" in this.state) || this.state.mediaSeatGranted));
	}

	setMediaSeat(targetUserId: string, targetParticipantSessionId: string, enabled: boolean): SetMediaSeat | null {
		const snapshot = this.snapshot;
		const state = snapshot?.participants.find(p => p.participantSessionId === targetParticipantSessionId);
		if (!snapshot || snapshot.capabilities.mediaProtocolVersion !== 3 || !state ||
			!("seatRevision" in state) || typeof state.seatRevision !== "number" || this.seatControls.get(targetUserId)?.pending) return null;
		const command: SetMediaSeat = {type: "SET_MEDIA_SEAT", roomId: this.roomId,
			roomGeneration: snapshot.roomGeneration, targetUserId, targetParticipantSessionId,
			expectedSeatRevision: state.seatRevision, enabled, requestId: crypto.randomUUID()};
		this.seatRequests.set(targetUserId, command);
		this.seatControls.set(targetUserId, {pending: true, requestId: command.requestId});
		return command;
	}

	interruptSeatCommands(): void {
		for (const userId of this.seatRequests.keys()) {
			this.seatControls.set(userId, {pending: false, error: "Connection interrupted. Check the seat and try again."});
		}
		this.seatRequests.clear();
	}

	intent(media: RoomMediaKind, enabled: boolean): MediaIntent | null {
		if (!this.snapshot || !this.state) return null;
		if (enabled && !this.hasSeat()) return null;
		const intent: MediaIntent = {
			type: "SET_MEDIA_INTENT",
			roomId: this.roomId,
			roomGeneration: this.snapshot.roomGeneration,
			participantSessionId: this.participantSessionId,
			media,
			enabled,
			revocationEpoch: this.state[`${media}RevocationEpoch`],
			intentSequence:
				Math.max(this.sequences[media], this.state[`${media}IntentSequence`]) +
				1,
			requestId: crypto.randomUUID(),
		};
		this.sequences[media] = intent.intentSequence;
		this.current.set(media, intent);
		this.accepted.delete(media);
		this.error = null;
		return intent;
	}

	/** Called only when RoomClient creates a new signaling transport. */
	beginTransport(): void {
		this.reconciled.clear();
	}

	/** An Off already sent on this socket needs no snapshot-triggered replay. */
	markIntentSent(intent: MediaIntent): void {
		if (!intent.enabled && this.current.get(intent.media)?.requestId === intent.requestId) {
			this.reconciled.set(intent.media, intent.requestId);
		}
	}

	/** At most one replay per current off intent per transport; no snapshot loop. */
	releaseRestoredGrants(): MediaIntent[] {
		if (!this.state) return [];
		const releases: MediaIntent[] = [];
		for (const media of ["camera", "microphone"] as const) {
			let intent = this.current.get(media);
			if (this.restorationPending && this.state[`${media}Granted`] && !intent)
				intent = this.intent(media, false) ?? undefined;
			if (
				intent &&
				!intent.enabled &&
				this.state[`${media}Granted`] &&
				intent.revocationEpoch === this.state[`${media}RevocationEpoch`] &&
				intent.intentSequence > this.state[`${media}IntentSequence`] &&
				this.reconciled.get(media) !== intent.requestId
			) {
				this.reconciled.set(media, intent.requestId);
				releases.push(intent);
			}
		}
		this.restorationPending = false;
		return releases;
	}

	captureIntent(media: RoomMediaKind): Readonly<MediaIntent> | undefined {
		return this.canCapture(media) ? this.current.get(media) : undefined;
	}

	disableFailedIntent(owner: Readonly<MediaIntent>): MediaIntent | null {
		const current = this.current.get(owner.media);
		if (
			!current?.enabled ||
			current.requestId !== owner.requestId ||
			current.intentSequence !== owner.intentSequence ||
			current.revocationEpoch !== owner.revocationEpoch ||
			owner.roomId !== this.roomId ||
			owner.participantSessionId !== this.participantSessionId ||
			owner.roomGeneration !== this.snapshot?.roomGeneration ||
			owner.revocationEpoch !== this.state?.[`${owner.media}RevocationEpoch`]
		)
			return null;
		return this.intent(owner.media, false);
	}

	wants(media: RoomMediaKind): boolean {
		return this.current.get(media)?.enabled === true;
	}

	canCapture(media: RoomMediaKind): boolean {
		const intent = this.current.get(media);
		return Boolean(
			intent?.enabled &&
				this.hasSeat() &&
				this.state?.[`${media}Granted`] &&
				intent.revocationEpoch === this.state[`${media}RevocationEpoch`] &&
				intent.intentSequence === this.state[`${media}IntentSequence`] &&
				this.accepted.get(media) === intent.intentSequence,
		);
	}

	consume(event: ServerEvent): boolean {
		// Feedback belongs to this event, not to every subsequent room update.
		this.error = null;
		if (event.type === "ROOM_SNAPSHOT") {
			if (event.roomId !== this.roomId || !event.participants.some(p => p.participantSessionId === this.participantSessionId)) return false;
			return this.bindRoomGeneration(event.roomGeneration);
		}
		if (event.type === "MEDIA_SEAT_RESULT") {
			if (event.snapshot.roomId !== this.roomId || event.snapshot.roomGeneration !== this.roomGeneration) return false;
			const acceptedSnapshot = this.consume(event.snapshot);
			for (const [userId, command] of this.seatRequests) {
				if (command.requestId !== event.requestId || command.targetParticipantSessionId !== event.targetParticipantSessionId) continue;
				this.seatRequests.delete(userId);
				const error = event.code === "OK" ? undefined : event.code === "MEDIA_LIMIT_REACHED"
					? "All media seats are in use. Free a seat first."
					: event.code === "MEDIA_STALE_SESSION" ? "Participant reconnected. Try again."
					: event.code === "MEDIA_STALE_SEAT_REVISION" ? "The seat changed. Check its state and try again."
					: "Could not change the media seat. Try again.";
				this.seatControls.set(userId, {pending: false, ...(error ? {error} : {})});
				return true;
			}
			return acceptedSnapshot;
		}
		if (event.type === "ROOM_MEDIA_SNAPSHOT") {
			if (
				this.roomGeneration === null ||
				(this.snapshot && event.capabilities.mediaProtocolVersion !== this.snapshot.capabilities.mediaProtocolVersion) ||
				!shouldApplyRoomMediaSnapshot({roomId: this.roomId, roomGeneration: this.roomGeneration}, this.snapshot, event)
			)
				return false;
			if (event.snapshotSequence < this.sequence) return false;
			this.snapshot = event;
			this.sequence = event.snapshotSequence;
			this.applyState(
				event.participants.find(
					(p) => p.participantSessionId === this.participantSessionId,
				) ?? null,
				true,
			);
			return true;
		}
		if (
			event.type !== "MEDIA_INTENT_ACK" &&
			event.type !== "MEDIA_INTENT_ERROR"
		)
			return false;
		if (
			!this.snapshot ||
			("mediaSeatGranted" in event.state) !== (this.snapshot.capabilities.mediaProtocolVersion === 3) ||
			event.roomId !== this.roomId ||
			event.roomGeneration !== this.snapshot.roomGeneration ||
			event.participantSessionId !== this.participantSessionId ||
			event.snapshotSequence < this.sequence
		)
			return false;
		this.sequence = event.snapshotSequence;
		this.applyState(event.state);
		const intent = this.current.get(event.media);
		if (
			!intent ||
			intent.requestId !== event.requestId ||
			intent.intentSequence !== event.intentSequence
		)
			return true;
		if (event.type === "MEDIA_INTENT_ERROR") {
			// A duplicate can be rejected after the original command committed.
			// Only the exact authoritative sequence/epoch and requested grant
			// count as success; a revoked or superseded intent stays rejected.
			if (event.code === "MEDIA_STALE_INTENT" &&
				intent.revocationEpoch === event.state[`${event.media}RevocationEpoch`] &&
				intent.intentSequence === event.state[`${event.media}IntentSequence`] &&
				intent.enabled === event.state[`${event.media}Granted`]) {
				this.accepted.set(event.media, intent.intentSequence);
				return true;
			}
			this.current.delete(event.media);
			this.accepted.delete(event.media);
			this.error =
				event.code === "MEDIA_LIMIT_REACHED"
					? event.media === "camera" ? "All 4 cameras are in use" : "All microphone places are occupied. Try again when one is free."
					: event.code === "MEDIA_SEAT_REQUIRED" ? "Media seat required"
					: event.code === "MEDIA_CAPABILITY_EXPIRED" ? "Media access expired. Rejoin the room."
					: event.code === "MEDIA_STALE_INTENT" ? "Media state changed. Try again."
					: "Could not update media. Try again.";
		} else if (
			intent.revocationEpoch === event.state[`${event.media}RevocationEpoch`] &&
			event.state[`${event.media}IntentSequence`] === intent.intentSequence
		) {
			this.accepted.set(event.media, intent.intentSequence);
		}
		return true;
	}

	private applyState(
		state: ParticipantMediaState | null,
		acceptSnapshot = false,
	): void {
		for (const media of ["camera", "microphone"] as const) {
			const intent = this.current.get(media);
			if (
				!state ||
				("mediaSeatGranted" in state && !state.mediaSeatGranted) ||
				(intent && intent.revocationEpoch !== state[`${media}RevocationEpoch`])
			) {
				this.current.delete(media);
				this.accepted.delete(media);
			}
		}
		// The snapshot carries the accepted sequence too: a lost ACK may be
		// recovered only for this document's still-current explicit intent.
		for (const media of ["camera", "microphone"] as const) {
			const intent = this.current.get(media);
			if (
				acceptSnapshot &&
				intent &&
				state &&
				intent.intentSequence === state[`${media}IntentSequence`] &&
				intent.revocationEpoch === state[`${media}RevocationEpoch`]
			)
				this.accepted.set(media, intent.intentSequence);
		}
		this.state = state;
	}

	reset(): void {
		this.error = null;
		this.snapshot = null;
		this.state = null;
		this.sequence = -1;
		this.restorationPending = true;
		this.reconciled.clear();
		this.current.clear();
		this.accepted.clear();
		this.sequences = { camera: 0, microphone: 0 };
		this.roomGeneration = null;
		this.seatRequests.clear();
		this.seatControls.clear();
	}
}
