import type {
	MediaIntent,
	ParticipantMediaState,
	RoomMediaKind,
	RoomMediaSnapshot,
	ServerEvent,
} from "@anidachi/protocol";

/** Client intent only. Server snapshots/ACKs remain the sole grant authority. */
export class RoomMediaSession {
	snapshot: RoomMediaSnapshot | null = null;
	error: string | null = null;
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

	intent(media: RoomMediaKind, enabled: boolean): MediaIntent | null {
		if (!this.snapshot || !this.state) return null;
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
				this.state?.[`${media}Granted`] &&
				intent.revocationEpoch === this.state[`${media}RevocationEpoch`] &&
				intent.intentSequence === this.state[`${media}IntentSequence`] &&
				this.accepted.get(media) === intent.intentSequence,
		);
	}

	consume(event: ServerEvent): boolean {
		if (event.type === "ROOM_MEDIA_SNAPSHOT") {
			if (
				event.roomId !== this.roomId ||
				(this.snapshot && event.roomGeneration < this.snapshot.roomGeneration)
			)
				return false;
			if (this.snapshot && event.roomGeneration > this.snapshot.roomGeneration)
				this.reset();
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
			this.current.delete(event.media);
			this.accepted.delete(event.media);
			this.error =
				event.code === "MEDIA_LIMIT_REACHED"
					? `All ${event.media} places are occupied. Try again when one is free.`
					: "Media request expired. Try again.";
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
		this.snapshot = null;
		this.state = null;
		this.sequence = -1;
		this.restorationPending = true;
		this.reconciled.clear();
		this.current.clear();
		this.accepted.clear();
		this.sequences = { camera: 0, microphone: 0 };
	}
}
