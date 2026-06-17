import type { Participant, PlaybackState, ServerEvent } from "@anidachi/protocol";

/** Mesh P2P is sized for small rooms (PD3); reject the 5th concurrent user. */
export const MAX_ROOM_PARTICIPANTS = 4;

export class RoomState {
  readonly roomId: string;
  private readonly participantsById = new Map<string, Participant>();
  private hostId: string | null = null;
  private hostState: PlaybackState | undefined;

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  /**
   * Whether a JOIN for this user can be admitted. A reconnecting/known user is
   * always allowed (they do not grow the room); a genuinely new user is
   * rejected once the room holds MAX_ROOM_PARTICIPANTS distinct participants.
   */
  canAdmit(userId: string): boolean {
    return this.participantsById.has(userId) || this.participantsById.size < MAX_ROOM_PARTICIPANTS;
  }

  get participants(): Participant[] {
    return Array.from(this.participantsById.values());
  }

  get currentHostId(): string | null {
    return this.hostId;
  }

  get snapshot(): ServerEvent {
    const base = {
      type: "ROOM_SNAPSHOT" as const,
      roomId: this.roomId,
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

    return leaving;
  }

  updateHostState(byUserId: string, state: PlaybackState): boolean {
    if (this.hostId !== byUserId || !this.participantsById.has(byUserId)) {
      return false;
    }

    this.hostState = state;
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
    return updated;
  }
}
