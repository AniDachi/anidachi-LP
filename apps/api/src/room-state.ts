import type { Participant, PlaybackState, ServerEvent } from "@anidachi/protocol";

export class RoomState {
  readonly roomId: string;
  private readonly participantsById = new Map<string, Participant>();
  private hostId: string | null = null;
  private hostState: PlaybackState | undefined;

  constructor(roomId: string) {
    this.roomId = roomId;
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
