import type {
  Participant,
  PlaybackState,
  RoomCapabilities,
  ServerEvent,
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

export class RoomState {
  readonly roomId: string;
  private capabilities: RoomCapabilities;
  private readonly participantsById = new Map<string, Participant>();
  private hostId: string | null = null;
  private hostState: PlaybackState | undefined;
  private roomGenerationValue = 1;
  private serverSeqValue = 0;
  private sourceGenerationValue = 1;

  constructor(roomId: string, capabilities: RoomCapabilities = LEGACY_ROOM_CAPABILITIES) {
    this.roomId = roomId;
    this.capabilities = capabilities;
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

    if (this.hostState) {
      return { ...base, hostState: this.hostState };
    }

    return base;
  }

  join(participant: Participant): Participant {
    const existing = this.participantsById.get(participant.id);
    const role = participant.role === "host" ? "host" : "viewer";

    if (role === "host") {
      this.hostId = participant.id;
    }

    const joined: Participant = {
      ...participant,
      cameraEnabled: existing?.cameraEnabled ?? participant.cameraEnabled,
      role,
      syncStatus: existing?.syncStatus ?? participant.syncStatus,
      lastSeenAt: Date.now(),
    };

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

  updateHostState(byUserId: string, state: PlaybackState): boolean {
    if (this.hostId !== byUserId || !this.participantsById.has(byUserId)) {
      return false;
    }

    this.hostState = state;
    this.bumpServerSeq();
    return true;
  }

  canControlPlayback(userId: string): boolean {
    return this.hostId === userId && this.participantsById.has(userId);
  }

  hasParticipant(userId: string): boolean {
    return this.participantsById.has(userId);
  }

  canSignal(fromUserId: string, toUserId: string): boolean {
    return (
      fromUserId !== toUserId && this.hasParticipant(fromUserId) && this.hasParticipant(toUserId)
    );
  }

  canEnableCamera(userId: string): boolean {
    const participant = this.participantsById.get(userId);
    if (!participant) {
      return false;
    }
    if (participant.cameraEnabled) {
      return true;
    }
    const activeMediaSeats = this.participants.filter((item) => item.cameraEnabled).length;
    return activeMediaSeats < this.capabilities.maxMediaSeats;
  }

  setCamera(userId: string, cameraEnabled: boolean): Participant | null {
    const participant = this.participantsById.get(userId);
    if (!participant) {
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

  private bumpServerSeq(): void {
    this.serverSeqValue += 1;
  }
}
