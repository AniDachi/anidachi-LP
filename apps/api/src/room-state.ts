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
    this.capabilities = snapshot?.capabilities ?? capabilities;
    if (snapshot) {
      for (const participant of snapshot.participants) {
        this.participantsById.set(participant.id, this.normalizePersistedParticipant(participant));
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
      this.participantsById.size < this.capabilities.maxParticipants
    );
  }

  get participants(): Participant[] {
    return Array.from(this.participantsById.values());
  }

  get occupiedMediaSeats(): number {
    return this.participants.filter((participant) => participant.mediaSeat === "joined").length;
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
    const existing = this.participantsById.get(participant.id);
    const role = participant.role === "host" ? "host" : "viewer";

    if (role === "host") {
      this.hostId = participant.id;
    }

    const nextMediaSeat =
      existing?.mediaSeat ?? (this.canAutoAssignMediaSeat() ? "joined" : "none");
    const joined: Participant = {
      ...participant,
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

  leave(participantId: string): Participant | null {
    const leaving = this.participantsById.get(participantId) ?? null;
    if (!leaving) {
      return null;
    }

    this.participantsById.delete(participantId);

    if (this.hostId === participantId) {
      const nextHost = this.participants.find((participant) => participant.role === "host");
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
    return participant.mediaSeat === "joined";
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

  grantMediaSeat(targetUserId: string, byUserId: string): MediaSeatChangeResult {
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

  revokeMediaSeat(targetUserId: string, byUserId: string): MediaSeatChangeResult {
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

export type MediaSeatChangeCode = "MEDIA_SEATS_FULL" | "NOT_HOST" | "NOT_PARTICIPANT";

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
  if (candidate.provider !== "crunchyroll" && candidate.provider !== "youtube") {
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
  if (candidate.provider !== "crunchyroll" && candidate.provider !== "youtube") {
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
  if (!matchesCanonicalFingerprint(
    candidate.sourceUrl,
    candidate.videoFingerprint,
    expectedFingerprint,
  )) {
    return null;
  }
  if (state?.sourceUrl) {
    const stateUrl = canonicalizeRoomSourceUrl(state.sourceUrl, candidate.provider);
    if (!stateUrl.ok || !sameCanonicalSource(sourceUrl.source, stateUrl.source)) {
      return null;
    }
    if (!matchesCanonicalFingerprint(
      state.sourceUrl,
      state.videoFingerprint,
      expectedFingerprint,
    )) {
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
  return fingerprint === expectedFingerprint ||
    isLegacyRoomSourceFingerprintAlias(sourceUrl, fingerprint);
}

function sameCanonicalSource(
  left: RoomSourceDescriptor,
  right: RoomSourceDescriptor,
): boolean {
  return left.provider === right.provider &&
    left.sourceUrl === right.sourceUrl &&
    left.canonicalUrl === right.canonicalUrl &&
    left.videoFingerprint === right.videoFingerprint;
}
