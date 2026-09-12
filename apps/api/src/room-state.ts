import {
	type RoomMediaCapabilities,
	type RoomMediaSnapshot,
	type ParticipantMediaState,
	type MediaIntent,
	type MediaIntentAck,
	type MediaIntentError,
	type HostMediaRevoke,
} from "@anidachi/protocol";
import type {
  Participant,
  PlaybackState,
  RoomCapabilities,
  RoomSourceDescriptor,
  ServerEvent,
  WatchSourceDescriptor,
} from "@anidachi/protocol";
import {
  RoomSourceDescriptorSchema,
  canonicalizeRoomSourceUrl,
  isLegacyRoomSourceFingerprintAlias,
} from "@anidachi/protocol";

export const LEGACY_ROOM_CAPABILITIES: RoomCapabilities = {
  hostPlanCode: "free",
  maxParticipants: 4,
  // Backward-compatible fallback for old room tokens that predate capability
  // claims. New Free rooms sign maxMediaSeats=0 from the web app.
  maxMediaSeats: 4,
  canNameRoom: false,
  canSendPushInvites: false,
};

export interface RoomStateSnapshot {
  schemaVersion: 1;
	media?: RoomMediaSnapshot;
	mediaRevocations?: string[];
  capabilities: RoomCapabilities;
  hostId: string | null;
  hostState?: PlaybackState;
  participants: Participant[];
  roomGeneration: number;
  serverSeq: number;
  source?: WatchSourceDescriptor;
  sourceGeneration: number;
  updatedAt: number;
}

export class RoomState {
  readonly roomId: string;
	private media: RoomMediaSnapshot | undefined;
	private mediaRevocations: string[] = [];
  private capabilities: RoomCapabilities;
  private readonly participantsById = new Map<string, Participant>();
  private hostId: string | null = null;
  private hostState: PlaybackState | undefined;
  private roomGenerationValue = 1;
  private serverSeqValue = 0;
  private source: WatchSourceDescriptor | undefined;
  private sourceProvider: WatchSourceDescriptor["provider"] | undefined;
  private sourceGenerationValue = 1;

  constructor(
    roomId: string,
    capabilities: RoomCapabilities = LEGACY_ROOM_CAPABILITIES,
    snapshot?: RoomStateSnapshot,
  ) {
    this.roomId = roomId;
		this.mediaRevocations = snapshot?.mediaRevocations ?? [];
		this.media = snapshot?.media ? structuredClone(snapshot.media) : undefined;
    this.capabilities = snapshot?.capabilities ?? capabilities;
    if (snapshot) {
      for (const participant of snapshot.participants) {
				this.participantsById.set(
					participant.id,
					this.normalizePersistedParticipant(participant),
				);
      }
      this.hostId = snapshot.hostId;
      this.roomGenerationValue = snapshot.roomGeneration;
      this.serverSeqValue = snapshot.serverSeq;
      this.sourceGenerationValue = snapshot.sourceGeneration;
      if (snapshot.source) {
        const restored = normalizeWatchSourceDescriptor(
          snapshot.source,
          snapshot.hostState,
        );
        if (restored) {
          if (restored.state) this.hostState = restored.state;
          this.source = restored.source;
          this.sourceProvider = restored.source.provider;
        }
      } else if (snapshot.hostState) {
        this.hostState = snapshot.hostState;
      }
    }
  }

  /**
   * Whether a JOIN for this user can be admitted. A reconnecting/known user is
   * always allowed (they do not grow the room); a genuinely new user is rejected
   * once the room reaches its signed maxParticipants capability.
   */
  canAdmit(userId: string): boolean {
    return (
      this.participantsById.has(userId) ||
			this.participantsById.size <
				(this.media?.capabilities.maxParticipants ??
					this.capabilities.maxParticipants)
    );
  }

  get participants(): Participant[] {
    return Array.from(this.participantsById.values());
  }

  get occupiedMediaSeats(): number {
		return this.participants.filter(
			(participant) => participant.mediaSeat === "joined",
		).length;
  }

  get currentHostId(): string | null {
    return this.hostId;
  }

  get roomCapabilities(): RoomCapabilities {
    return this.capabilities;
  }

  get roomGeneration(): number {
    return this.roomGenerationValue;
  }

  get serverSeq(): number {
    return this.serverSeqValue;
  }

  get sourceGeneration(): number {
    return this.sourceGenerationValue;
  }

  get currentSourceProvider(): WatchSourceDescriptor["provider"] | undefined {
    return this.sourceProvider;
  }

  get currentDurableSource(): RoomSourceDescriptor | undefined {
    if (!this.source) return undefined;
    const durableSource = {
      provider: this.source.provider,
      sourceUrl: this.source.sourceUrl,
      canonicalUrl: this.source.canonicalUrl,
      videoFingerprint: this.source.videoFingerprint,
    };
    const parsed = RoomSourceDescriptorSchema.safeParse(durableSource);
    return parsed.success ? parsed.data : undefined;
  }

  setCapabilities(capabilities: RoomCapabilities): void {
    const changed =
      this.capabilities.hostPlanCode !== capabilities.hostPlanCode ||
      this.capabilities.maxParticipants !== capabilities.maxParticipants ||
      this.capabilities.maxMediaSeats !== capabilities.maxMediaSeats ||
      this.capabilities.canNameRoom !== capabilities.canNameRoom ||
      this.capabilities.canSendPushInvites !== capabilities.canSendPushInvites;
    this.capabilities = capabilities;
    if (changed) {
      this.bumpServerSeq();
    }
  }

  get snapshot(): ServerEvent {
    const base = {
      type: "ROOM_SNAPSHOT" as const,
      roomId: this.roomId,
      roomGeneration: this.roomGenerationValue,
      serverSeq: this.serverSeqValue,
      sourceGeneration: this.sourceGenerationValue,
      capabilities: this.capabilities,
      participants: this.participants,
    };

    const withSource = this.source ? { ...base, source: this.source } : base;

    if (this.hostState) {
      return { ...withSource, hostState: this.hostState };
    }

    return withSource;
  }

  join(participant: Participant): Participant {
		if (
			this.media &&
			(!participant.participantSessionId ||
				this.participants.some(
					(p) =>
						p.id !== participant.id &&
						p.participantSessionId === participant.participantSessionId,
				))
		)
			throw new Error("MEDIA_STALE_SESSION");
    const existing = this.participantsById.get(participant.id);
    const role = participant.role === "host" ? "host" : "viewer";

    if (role === "host") {
      this.hostId = participant.id;
    }

		if (this.media) {
			if (existing?.participantSessionId !== participant.participantSessionId)
				this.media.participants = this.media.participants.filter(
					(p) => p.participantSessionId !== existing?.participantSessionId,
				);
			if (
				participant.participantSessionId &&
				!this.media.participants.some(
					(p) => p.participantSessionId === participant.participantSessionId,
				)
			)
				this.media.participants.push({
					...emptyMediaState(),
					participantSessionId: participant.participantSessionId,
				});
		}
		const nextMediaSeat = this.media
			? "none"
			: (existing?.mediaSeat ??
				(this.canAutoAssignMediaSeat() ? "joined" : "none"));
    const joined: Participant = {
      ...participant,
			...(this.media ? { connected: true } : {}),
      cameraEnabled: existing?.cameraEnabled ?? participant.cameraEnabled,
      mediaSeat: nextMediaSeat,
      role,
      syncStatus: existing?.syncStatus ?? participant.syncStatus,
      lastSeenAt: Date.now(),
    };
    if (joined.mediaSeat === "joined") {
      joined.mediaSeatSource = existing?.mediaSeatSource ?? "auto";
    } else {
      delete joined.mediaSeatSource;
      joined.cameraEnabled = false;
    }

    this.participantsById.set(joined.id, joined);
    this.bumpServerSeq();
    return joined;
  }

	disconnect(userId: string): Participant | null {
		const participant = this.participantsById.get(userId);
		if (!participant) return null;
		const disconnected = {
			...participant,
			connected: false,
			cameraEnabled: false,
		};
		this.participantsById.set(userId, disconnected);
		this.bumpServerSeq();
		return disconnected;
	}
  leave(participantId: string): Participant | null {
    const leaving = this.participantsById.get(participantId) ?? null;
    if (!leaving) {
      return null;
    }

    this.participantsById.delete(participantId);
		if (this.media)
			this.media.participants = this.media.participants.filter(
				(p) => p.participantSessionId !== leaving.participantSessionId,
			);

    if (this.hostId === participantId) {
			const nextHost = this.participants.find(
				(participant) => participant.role === "host",
			);
      this.hostId = nextHost?.id ?? null;

      if (!nextHost) {
        this.hostState = undefined;
      }
    }

    this.bumpServerSeq();
    return leaving;
  }

  updateHostState(
    byUserId: string,
    state: PlaybackState,
    source?: WatchSourceDescriptor,
  ): HostStateUpdateResult {
    if (this.hostId !== byUserId || !this.participantsById.has(byUserId)) {
      return { accepted: false, sourceChanged: false, code: "NOT_HOST" };
    }

    const previousSource = this.source;
    const normalized = normalizeRoomSourceUpdate(state, source, previousSource);
    if (!normalized) {
      return { accepted: false, sourceChanged: false, code: "INVALID_SOURCE" };
    }
    const nextSource = normalized.source;
    if (
      nextSource &&
      this.sourceProvider !== undefined &&
      nextSource.provider !== this.sourceProvider
    ) {
      return {
        accepted: false,
        sourceChanged: false,
        code: "SOURCE_PROVIDER_MISMATCH",
      };
    }

    const sourceChanged =
      nextSource !== undefined &&
      (previousSource === undefined ||
        previousSource.videoFingerprint !== nextSource.videoFingerprint);

    this.hostState = normalized.state;
    this.source = nextSource;
    if (nextSource && this.sourceProvider === undefined) {
      this.sourceProvider = nextSource.provider;
    }
    if (sourceChanged) {
      this.sourceGenerationValue += 1;
    }
    this.bumpServerSeq();
    if (sourceChanged && nextSource && normalized.durableSource) {
      return {
        accepted: true,
        sourceChanged: true,
        state: normalized.state,
        source: nextSource,
        durableSource: normalized.durableSource,
        ...(previousSource ? { previousSource } : {}),
      };
    }
    return {
      accepted: true,
      sourceChanged: false,
      state: normalized.state,
      ...(nextSource ? { source: nextSource } : {}),
      ...(normalized.durableSource
        ? { durableSource: normalized.durableSource }
        : {}),
      ...(previousSource ? { previousSource } : {}),
    };
  }

  canControlPlayback(userId: string): boolean {
    return this.hostId === userId && this.participantsById.has(userId);
  }

  hasParticipant(userId: string): boolean {
    return this.participantsById.has(userId);
  }

  canSignal(fromUserId: string, toUserId: string): boolean {
    const from = this.participantsById.get(fromUserId);
    const to = this.participantsById.get(toUserId);
		if (this.media) {
			const a = this.mediaFor(fromUserId),
				b = this.mediaFor(toUserId);
			return (
				fromUserId !== toUserId &&
				from?.connected !== false &&
				to?.connected !== false &&
				!!a &&
				!!b &&
				(a.cameraGranted ||
					a.microphoneGranted ||
					b.cameraGranted ||
					b.microphoneGranted)
			);
		}
    return (
      fromUserId !== toUserId &&
      from?.mediaSeat === "joined" &&
      to?.mediaSeat === "joined"
    );
  }

  canEnableCamera(userId: string): boolean {
    const participant = this.participantsById.get(userId);
    if (!participant) {
      return false;
    }
		return this.media
			? this.mediaFor(userId)?.cameraGranted === true
			: participant.mediaSeat === "joined";
  }

  setCamera(userId: string, cameraEnabled: boolean): Participant | null {
    const participant = this.participantsById.get(userId);
    if (!participant) {
      return null;
    }
    if (cameraEnabled && !this.canEnableCamera(userId)) {
      return null;
    }

    const updated: Participant = {
      ...participant,
      cameraEnabled,
      lastSeenAt: Date.now(),
    };
    this.participantsById.set(userId, updated);
    this.bumpServerSeq();
    return updated;
  }

  requestMediaSeat(userId: string): Participant | null {
    const participant = this.participantsById.get(userId);
    if (!participant) {
      return null;
    }
    if (participant.mediaSeat === "joined") {
      return participant;
    }
    const updated: Participant = {
      ...participant,
      cameraEnabled: false,
      mediaSeat: "requested",
      lastSeenAt: Date.now(),
    };
    delete updated.mediaSeatSource;
    this.participantsById.set(userId, updated);
    this.bumpServerSeq();
    return updated;
  }

  cancelMediaSeatRequest(userId: string): Participant | null {
    const participant = this.participantsById.get(userId);
    if (!participant || participant.mediaSeat !== "requested") {
      return participant ?? null;
    }
    const updated: Participant = {
      ...participant,
      cameraEnabled: false,
      mediaSeat: "none",
      lastSeenAt: Date.now(),
    };
    delete updated.mediaSeatSource;
    this.participantsById.set(userId, updated);
    this.bumpServerSeq();
    return updated;
  }

  leaveMediaSeat(userId: string): Participant | null {
    const participant = this.participantsById.get(userId);
    if (!participant) {
      return null;
    }
    if (participant.mediaSeat === "none") {
      return participant;
    }
    const updated: Participant = {
      ...participant,
      cameraEnabled: false,
      mediaSeat: "none",
      lastSeenAt: Date.now(),
    };
    delete updated.mediaSeatSource;
    this.participantsById.set(userId, updated);
    this.bumpServerSeq();
    return updated;
  }

	grantMediaSeat(
		targetUserId: string,
		byUserId: string,
	): MediaSeatChangeResult {
    if (!this.canManageMediaSeats(byUserId)) {
      return { accepted: false, code: "NOT_HOST" };
    }
    const participant = this.participantsById.get(targetUserId);
    if (!participant) {
      return { accepted: false, code: "NOT_PARTICIPANT" };
    }
    if (participant.mediaSeat === "joined") {
      return { accepted: true, participant };
    }
    if (this.occupiedMediaSeats >= this.capabilities.maxMediaSeats) {
      return { accepted: false, code: "MEDIA_SEATS_FULL" };
    }
    const updated: Participant = {
      ...participant,
      mediaSeat: "joined",
      mediaSeatSource: "host",
      lastSeenAt: Date.now(),
    };
    this.participantsById.set(targetUserId, updated);
    this.bumpServerSeq();
    return { accepted: true, participant: updated };
  }

	revokeMediaSeat(
		targetUserId: string,
		byUserId: string,
	): MediaSeatChangeResult {
    if (!this.canManageMediaSeats(byUserId)) {
      return { accepted: false, code: "NOT_HOST" };
    }
    const participant = this.participantsById.get(targetUserId);
    if (!participant) {
      return { accepted: false, code: "NOT_PARTICIPANT" };
    }
    if (participant.mediaSeat === "none" && !participant.cameraEnabled) {
      return { accepted: true, participant };
    }
    const updated: Participant = {
      ...participant,
      cameraEnabled: false,
      mediaSeat: "none",
      lastSeenAt: Date.now(),
    };
    delete updated.mediaSeatSource;
    this.participantsById.set(targetUserId, updated);
    this.bumpServerSeq();
    return { accepted: true, participant: updated };
  }

  toSnapshot(updatedAt = Date.now()): RoomStateSnapshot {
    const snapshot: RoomStateSnapshot = {
      schemaVersion: 1,
			...(this.media
				? {
						media: structuredClone(this.mediaSnapshot!),
						mediaRevocations: [...this.mediaRevocations],
					}
				: {}),
      capabilities: this.capabilities,
      hostId: this.hostId,
      participants: this.participants,
      roomGeneration: this.roomGenerationValue,
      serverSeq: this.serverSeqValue,
      sourceGeneration: this.sourceGenerationValue,
      updatedAt,
    };
    if (this.hostState) {
      snapshot.hostState = this.hostState;
    }
    if (this.source) {
      snapshot.source = this.source;
    }
    return snapshot;
	}

	get mediaSnapshot(): RoomMediaSnapshot | undefined {
		return this.media
			? {
					...structuredClone(this.media),
					snapshotSequence: this.serverSeqValue,
				}
			: undefined;
	}
	setMediaCapabilities(caps: RoomMediaCapabilities): boolean {
		if (this.media) {
			const old = this.media.capabilities;
			if (
				old.hostPlanCode !== caps.hostPlanCode ||
				old.maxParticipants !== caps.maxParticipants ||
				old.maxCameras !== caps.maxCameras ||
				old.maxMicrophones !== caps.maxMicrophones ||
				this.media.closingAt ||
				caps.capabilityRevision <= old.capabilityRevision
			)
				return false;
			this.media.capabilities = caps;
		} else {
			if (this.participants.length) return false;
			this.media = {
				type: "ROOM_MEDIA_SNAPSHOT",
				roomId: this.roomId,
				roomGeneration: this.roomGenerationValue,
				snapshotSequence: this.serverSeqValue,
				capabilities: caps,
				participants: [],
				closingAt: null,
			};
		}
		this.bumpServerSeq();
		return true;
	}
	closeMediaAt(at: number): void {
		if (this.media && !this.media.closingAt) {
			this.media.closingAt = new Date(at).toISOString();
			this.bumpServerSeq();
		}
	}
	mediaFor(userId: string): ParticipantMediaState | undefined {
		const session = this.participantsById.get(userId)?.participantSessionId;
		return this.media?.participants.find(
			(p) => p.participantSessionId === session,
		);
	}
	applyMediaIntent(
		userId: string,
		intent: MediaIntent,
		now = Date.now(),
	): MediaIntentAck | MediaIntentError {
		const state = this.mediaFor(userId);
		const seqKey =
			intent.media === "camera"
				? "cameraIntentSequence"
				: "microphoneIntentSequence";
		const grantKey =
			intent.media === "camera" ? "cameraGranted" : "microphoneGranted";
		let code: MediaIntentError["code"] | undefined;
		if (
			!this.media ||
			intent.roomId !== this.roomId ||
			intent.roomGeneration !== this.roomGenerationValue
		)
			code = "MEDIA_STALE_GENERATION";
		else if (
			!state ||
			this.participantsById.get(userId)?.participantSessionId !==
				intent.participantSessionId
		)
			code = "MEDIA_STALE_SESSION";
		else if (
			intent.revocationEpoch !==
			state[
				intent.media === "camera"
					? "cameraRevocationEpoch"
					: "microphoneRevocationEpoch"
			]
		)
			code = "MEDIA_STALE_INTENT";
		else if (intent.intentSequence <= state[seqKey])
			code = "MEDIA_STALE_INTENT";
		else {
			state[seqKey] = intent.intentSequence;
			if (
				intent.enabled &&
				(this.media.closingAt ||
					now >= Date.parse(this.media.capabilities.capabilitiesValidUntil))
			)
				code = "MEDIA_CAPABILITY_EXPIRED";
			else if (
				intent.enabled &&
				!state[grantKey] &&
				this.media.participants.filter((p) => p[grantKey]).length >=
					(intent.media === "camera"
						? this.media.capabilities.maxCameras
						: this.media.capabilities.maxMicrophones)
			)
				code = "MEDIA_LIMIT_REACHED";
			else {
				state[grantKey] = intent.enabled;
				if (!intent.enabled && intent.media === "camera")
					this.setCamera(userId, false);
			}
			this.bumpServerSeq();
		}
		const reply = {
			roomId: this.roomId,
			roomGeneration: this.roomGenerationValue,
			participantSessionId: intent.participantSessionId,
			media: intent.media,
			requestId: intent.requestId,
			intentSequence: intent.intentSequence,
			snapshotSequence: this.serverSeqValue,
			state: state
				? {
						cameraGranted: state.cameraGranted,
						microphoneGranted: state.microphoneGranted,
						cameraIntentSequence: state.cameraIntentSequence,
						microphoneIntentSequence: state.microphoneIntentSequence,
						cameraRevocationEpoch: state.cameraRevocationEpoch,
						microphoneRevocationEpoch: state.microphoneRevocationEpoch,
					}
				: emptyMediaState(),
		};
		return code
			? { type: "MEDIA_INTENT_ERROR", ...reply, code }
			: { type: "MEDIA_INTENT_ACK", ...reply };
	}
	revokeMediaGrant(byUserId: string, event: HostMediaRevoke): boolean {
		if (
			!this.canControlPlayback(byUserId) ||
			event.roomId !== this.roomId ||
			event.roomGeneration !== this.roomGenerationValue
		)
			return false;
		const revokeKey = JSON.stringify([
			event.roomGeneration,
			event.targetParticipantSessionId,
			event.media,
			event.requestId,
		]);
		if (this.mediaRevocations.includes(revokeKey)) return true;
		if (this.mediaRevocations.length >= 1024) return false;
		const target = this.media?.participants.find(
			(p) => p.participantSessionId === event.targetParticipantSessionId,
		);
		if (!target) return false;
		const key =
			event.media === "camera" ? "cameraGranted" : "microphoneGranted";
		target[key] = false;
		target[
			event.media === "camera"
				? "cameraRevocationEpoch"
				: "microphoneRevocationEpoch"
		] += 1;
		this.mediaRevocations.push(revokeKey);
		if (event.media === "camera") {
			const p = this.participants.find(
				(p) => p.participantSessionId === event.targetParticipantSessionId,
			);
			if (p) this.setCamera(p.id, false);
		}
		this.bumpServerSeq();
		return true;
  }

  private bumpServerSeq(): void {
    this.serverSeqValue += 1;
  }

  private canAutoAssignMediaSeat(): boolean {
    return (
      this.capabilities.maxMediaSeats > 0 &&
      this.occupiedMediaSeats < this.capabilities.maxMediaSeats
    );
  }

  private canManageMediaSeats(userId: string): boolean {
    return this.hostId === userId && this.participantsById.has(userId);
  }

  private normalizePersistedParticipant(participant: Participant): Participant {
    if (participant.mediaSeat === "joined") {
      return {
        ...participant,
        mediaSeatSource: participant.mediaSeatSource ?? "auto",
      };
    }
    return {
      ...participant,
      cameraEnabled: false,
      mediaSeat: participant.mediaSeat === "requested" ? "requested" : "none",
      mediaSeatSource: undefined,
    };
  }
}

export type HostStateUpdateResult =
  | {
      accepted: false;
      sourceChanged: false;
      code: HostStateUpdateErrorCode;
    }
  | {
      accepted: true;
      sourceChanged: false;
      durableSource?: RoomSourceDescriptor;
      state: PlaybackState;
      source?: WatchSourceDescriptor;
      previousSource?: WatchSourceDescriptor;
    }
  | {
      accepted: true;
      sourceChanged: true;
      durableSource: RoomSourceDescriptor;
      state: PlaybackState;
      source: WatchSourceDescriptor;
      previousSource?: WatchSourceDescriptor;
    };

export type HostStateUpdateErrorCode =
  | "INVALID_SOURCE"
  | "NOT_HOST"
  | "SOURCE_PROVIDER_MISMATCH";

export type MediaSeatChangeCode =
	| "MEDIA_SEATS_FULL"
	| "NOT_HOST"
	| "NOT_PARTICIPANT";

export type MediaSeatChangeResult =
  | { accepted: true; participant: Participant }
  | { accepted: false; code: MediaSeatChangeCode };

interface NormalizedRoomSourceUpdate {
  durableSource?: RoomSourceDescriptor;
  source?: WatchSourceDescriptor;
  state: PlaybackState;
}

interface NormalizedWatchSourceDescriptor {
  durableSource: RoomSourceDescriptor;
  source: WatchSourceDescriptor;
  state?: PlaybackState;
}

function normalizeRoomSourceUpdate(
  state: PlaybackState,
  source: WatchSourceDescriptor | undefined,
  previousSource: WatchSourceDescriptor | undefined,
): NormalizedRoomSourceUpdate | null {
  let candidate = source;
  if (!candidate && previousSource) {
    candidate = state.sourceUrl
      ? { ...previousSource, sourceUrl: state.sourceUrl }
      : previousSource;
  }
  if (!candidate && state.sourceUrl) {
    const canonical = canonicalizeRoomSourceUrl(state.sourceUrl);
    if (!canonical.ok) return null;
    candidate = {
      ...canonical.source,
      videoFingerprint: state.videoFingerprint,
      title: "Untitled source",
    };
  }
  if (!candidate) {
    return previousSource ? null : { state };
  }
	if (
		candidate.provider !== "crunchyroll" &&
		candidate.provider !== "youtube"
	) {
    return null;
  }

  const normalized = normalizeWatchSourceDescriptor(candidate, state);
  if (!normalized) return null;
  return {
    durableSource: normalized.durableSource,
    source: normalized.source,
    state: normalized.state ?? state,
  };
}

function normalizeWatchSourceDescriptor(
  candidate: WatchSourceDescriptor,
  state?: PlaybackState,
): NormalizedWatchSourceDescriptor | null {
	if (
		candidate.provider !== "crunchyroll" &&
		candidate.provider !== "youtube"
	) {
    return null;
  }

  const sourceUrl = canonicalizeRoomSourceUrl(
    candidate.sourceUrl,
    candidate.provider,
  );
  const canonicalUrl = canonicalizeRoomSourceUrl(
    candidate.canonicalUrl,
    candidate.provider,
  );
  if (
    !sourceUrl.ok ||
    !canonicalUrl.ok ||
    !sameCanonicalSource(sourceUrl.source, canonicalUrl.source)
  ) {
    return null;
  }

  const expectedFingerprint = sourceUrl.source.videoFingerprint;
	if (
		!matchesCanonicalFingerprint(
    candidate.sourceUrl,
    candidate.videoFingerprint,
    expectedFingerprint,
		)
	) {
    return null;
  }
  if (state?.sourceUrl) {
		const stateUrl = canonicalizeRoomSourceUrl(
			state.sourceUrl,
			candidate.provider,
		);
		if (
			!stateUrl.ok ||
			!sameCanonicalSource(sourceUrl.source, stateUrl.source)
		) {
      return null;
    }
		if (
			!matchesCanonicalFingerprint(
      state.sourceUrl,
      state.videoFingerprint,
      expectedFingerprint,
			)
		) {
      return null;
    }
  } else if (state && state.videoFingerprint !== expectedFingerprint) {
    return null;
  }

  const durableSource: RoomSourceDescriptor = {
    provider: sourceUrl.source.provider,
    sourceUrl: sourceUrl.source.sourceUrl,
    canonicalUrl: sourceUrl.source.canonicalUrl,
    videoFingerprint: expectedFingerprint,
  };
  if (!RoomSourceDescriptorSchema.safeParse(durableSource).success) return null;

  return {
    durableSource,
    source: {
      ...candidate,
      ...durableSource,
    },
    ...(state
      ? {
          state: {
            ...state,
            sourceUrl: durableSource.sourceUrl,
            videoFingerprint: durableSource.videoFingerprint,
          },
        }
      : {}),
  };
}

function matchesCanonicalFingerprint(
  sourceUrl: string,
  fingerprint: string,
  expectedFingerprint: string,
): boolean {
	return (
		fingerprint === expectedFingerprint ||
		isLegacyRoomSourceFingerprintAlias(sourceUrl, fingerprint)
	);
}

function sameCanonicalSource(
  left: RoomSourceDescriptor,
  right: RoomSourceDescriptor,
): boolean {
	return (
		left.provider === right.provider &&
    left.sourceUrl === right.sourceUrl &&
    left.canonicalUrl === right.canonicalUrl &&
		left.videoFingerprint === right.videoFingerprint
	);
}

function emptyMediaState(): ParticipantMediaState {
	return {
		cameraRevocationEpoch: 0,
		microphoneRevocationEpoch: 0,
		cameraGranted: false,
		microphoneGranted: false,
		cameraIntentSequence: 0,
		microphoneIntentSequence: 0,
	};
}
