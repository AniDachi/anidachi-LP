import type {
  Participant,
  PlaybackState,
  RoomCapabilities,
  ServerEvent,
  WatchSourceDescriptor,
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
      if (snapshot.hostState) {
        this.hostState = snapshot.hostState;
      }
      if (
        snapshot.source &&
        validateWatchSourceDescriptor(snapshot.source, snapshot.hostState)
      ) {
        this.source = snapshot.source;
        this.sourceProvider = snapshot.source.provider;
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
    const nextSource = resolveWatchSourceDescriptor(state, source, previousSource);
    if (!nextSource && previousSource) {
      return { accepted: false, sourceChanged: false, code: "INVALID_SOURCE" };
    }
    if (nextSource && !validateWatchSourceDescriptor(nextSource, state)) {
      return { accepted: false, sourceChanged: false, code: "INVALID_SOURCE" };
    }
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

    this.hostState = state;
    this.source = nextSource;
    if (nextSource && this.sourceProvider === undefined) {
      this.sourceProvider = nextSource.provider;
    }
    if (sourceChanged) {
      this.sourceGenerationValue += 1;
    }
    this.bumpServerSeq();
    return {
      accepted: true,
      sourceChanged,
      ...(nextSource ? { source: nextSource } : {}),
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

export interface HostStateUpdateResult {
  accepted: boolean;
  sourceChanged: boolean;
  code?: HostStateUpdateErrorCode;
  source?: WatchSourceDescriptor;
  previousSource?: WatchSourceDescriptor;
}

export type HostStateUpdateErrorCode =
  | "INVALID_SOURCE"
  | "NOT_HOST"
  | "SOURCE_PROVIDER_MISMATCH";

export type MediaSeatChangeCode = "MEDIA_SEATS_FULL" | "NOT_HOST" | "NOT_PARTICIPANT";

export type MediaSeatChangeResult =
  | { accepted: true; participant: Participant }
  | { accepted: false; code: MediaSeatChangeCode };

function resolveWatchSourceDescriptor(
  state: PlaybackState,
  source: WatchSourceDescriptor | undefined,
  previousSource: WatchSourceDescriptor | undefined,
): WatchSourceDescriptor | undefined {
  if (source) {
    return source;
  }

  if (
    previousSource &&
    previousSource.videoFingerprint === state.videoFingerprint
  ) {
    return state.sourceUrl
      ? { ...previousSource, sourceUrl: state.sourceUrl }
      : previousSource;
  }

  const sourceUrl = state.sourceUrl;
  if (!sourceUrl) {
    return undefined;
  }

  return {
    provider: providerFromFingerprint(state.videoFingerprint),
    sourceUrl,
    canonicalUrl: sourceUrl,
    videoFingerprint: state.videoFingerprint,
    title: "Untitled source",
  };
}

function providerFromFingerprint(fingerprint: string): WatchSourceDescriptor["provider"] {
  if (fingerprint.startsWith("crunchyroll|")) {
    return "crunchyroll";
  }
  if (fingerprint.startsWith("youtube|")) {
    return "youtube";
  }
  return "generic";
}

function validateWatchSourceDescriptor(
  source: WatchSourceDescriptor,
  state?: PlaybackState,
): boolean {
  if (
    (state && source.videoFingerprint !== state.videoFingerprint) ||
    providerFromFingerprint(source.videoFingerprint) !== source.provider
  ) {
    return false;
  }

  const sourceIdentity = sourceIdentityFromUrl(source.provider, source.sourceUrl);
  const canonicalIdentity = sourceIdentityFromUrl(
    source.provider,
    source.canonicalUrl,
  );
  if (!sourceIdentity || !canonicalIdentity || sourceIdentity !== canonicalIdentity) {
    return false;
  }

  const expectedIdentity = sourceIdentityFromFingerprint(
    source.provider,
    source.videoFingerprint,
  );
  if (source.provider !== "generic" && expectedIdentity === null) {
    return false;
  }
  if (expectedIdentity !== null && sourceIdentity !== expectedIdentity) {
    return false;
  }

  if (state?.sourceUrl) {
    const stateIdentity = sourceIdentityFromUrl(source.provider, state.sourceUrl);
    if (!stateIdentity || stateIdentity !== sourceIdentity) {
      return false;
    }
  }

  return true;
}

function sourceIdentityFromFingerprint(
  provider: WatchSourceDescriptor["provider"],
  fingerprint: string,
): string | null {
  if (provider === "youtube") {
    const videoId = fingerprint.slice("youtube|".length);
    return isValidYouTubeVideoId(videoId) ? videoId : null;
  }
  if (provider === "crunchyroll") {
    const videoKey = fingerprint.slice("crunchyroll|".length);
    return /^watch\/[^/]+$/.test(videoKey) ? videoKey : null;
  }
  return null;
}

function sourceIdentityFromUrl(
  provider: WatchSourceDescriptor["provider"],
  value: string,
): string | null {
  const url = parseHttpUrl(value);
  if (!url || providerFromUrl(url) !== provider) {
    return null;
  }

  if (provider === "youtube") {
    return youtubeVideoIdFromUrl(url);
  }
  if (provider === "crunchyroll") {
    const match = url.pathname.match(
      /(?:^|\/)watch\/([^/]+)(?:\/[^/]+)?\/?$/,
    );
    return match?.[1] ? `watch/${match[1]}` : null;
  }

  return `${url.origin}${url.pathname}${url.search}`;
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}

function providerFromUrl(url: URL): WatchSourceDescriptor["provider"] {
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "youtube.com" ||
    hostname.endsWith(".youtube.com") ||
    hostname === "youtube-nocookie.com" ||
    hostname.endsWith(".youtube-nocookie.com") ||
    hostname === "youtu.be"
  ) {
    return "youtube";
  }
  if (
    hostname === "crunchyroll.com" ||
    hostname.endsWith(".crunchyroll.com")
  ) {
    return "crunchyroll";
  }
  return "generic";
}

function youtubeVideoIdFromUrl(url: URL): string | null {
  const hostname = url.hostname.toLowerCase();
  if (hostname === "youtu.be") {
    const segments = url.pathname.split("/").filter(Boolean);
    const videoId = segments[0];
    return segments.length === 1 &&
      videoId !== undefined &&
      isValidYouTubeVideoId(videoId)
      ? videoId
      : null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  let videoId: string | null = null;
  const isYouTubeHost =
    hostname === "youtube.com" || hostname.endsWith(".youtube.com");
  if (
    isYouTubeHost &&
    segments.length === 1 &&
    segments[0] === "watch"
  ) {
    videoId = url.searchParams.get("v");
  }
  return videoId && isValidYouTubeVideoId(videoId) ? videoId : null;
}

function isValidYouTubeVideoId(value: string): boolean {
  return /^[A-Za-z0-9_-]{6,}$/.test(value);
}
