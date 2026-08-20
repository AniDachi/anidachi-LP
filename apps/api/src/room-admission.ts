export const ROOM_ADMISSION_PENDING_PER_SUBJECT_LIMIT = 2;
export const ROOM_ADMISSION_JOIN_DEADLINE_MS = 10_000;

export interface RoomAdmissionSocket {
  deadlineAt: number;
  joined: boolean;
  socketId: string;
  subject: string;
}

export type RoomAdmissionResult =
  | { allowed: true; deadlineAt: number }
  | { allowed: false; reason: "room_pending_limit" | "subject_pending_limit" };

export type RoomAdmissionJoinResult =
  | { allowed: true }
  | { allowed: false; reason: "join_deadline_elapsed" | "unknown_socket" };

export class RoomAdmission {
  private readonly sockets = new Map<string, RoomAdmissionSocket>();
  private readonly pendingBySubject = new Map<string, number>();
  private pending = 0;

  private maxParticipants: number;

  constructor(options: { maxParticipants: number }) {
    this.maxParticipants = options.maxParticipants;
  }

  setMaxParticipants(maxParticipants: number): void {
    this.maxParticipants = maxParticipants;
  }

  static rehydrate(options: {
    maxParticipants: number;
    sockets: RoomAdmissionSocket[];
  }): RoomAdmission {
    const admission = new RoomAdmission({ maxParticipants: options.maxParticipants });
    for (const socket of options.sockets) {
      admission.restore(socket);
    }
    return admission;
  }

  get pendingCount(): number {
    return this.pending;
  }

  reserve(subject: string, socketId: string, now = Date.now()): RoomAdmissionResult {
    const pendingForSubject = this.pendingBySubject.get(subject) ?? 0;
    if (pendingForSubject >= ROOM_ADMISSION_PENDING_PER_SUBJECT_LIMIT) {
      return { allowed: false, reason: "subject_pending_limit" };
    }
    if (this.pending >= this.pendingRoomLimit) {
      return { allowed: false, reason: "room_pending_limit" };
    }

    const deadlineAt = now + ROOM_ADMISSION_JOIN_DEADLINE_MS;
    this.add({ deadlineAt, joined: false, socketId, subject });
    return { allowed: true, deadlineAt };
  }

  restore(socket: RoomAdmissionSocket): boolean {
    if (this.sockets.has(socket.socketId)) return false;
    if (socket.joined) {
      this.sockets.set(socket.socketId, socket);
      return true;
    }
    const pendingForSubject = this.pendingBySubject.get(socket.subject) ?? 0;
    if (
      pendingForSubject >= ROOM_ADMISSION_PENDING_PER_SUBJECT_LIMIT ||
      this.pending >= this.pendingRoomLimit
    ) {
      return false;
    }
    this.add(socket);
    return true;
  }

  join(socketId: string, now = Date.now()): RoomAdmissionJoinResult {
    const decision = this.canJoin(socketId, now);
    if (!decision.allowed) return decision;
    const socket = this.sockets.get(socketId);
    if (!socket || socket.joined) return { allowed: true };

    socket.joined = true;
    this.decrementPending(socket.subject);
    return { allowed: true };
  }

  canJoin(socketId: string, now = Date.now()): RoomAdmissionJoinResult {
    const socket = this.sockets.get(socketId);
    if (!socket) return { allowed: false, reason: "unknown_socket" };
    if (socket.joined || now < socket.deadlineAt) return { allowed: true };
    return { allowed: false, reason: "join_deadline_elapsed" };
  }

  isPending(socketId: string): boolean {
    return this.sockets.get(socketId)?.joined === false;
  }

  release(socketId: string): boolean {
    const socket = this.sockets.get(socketId);
    if (!socket) return false;
    this.sockets.delete(socketId);
    if (!socket.joined) {
      this.decrementPending(socket.subject);
      return true;
    }
    return false;
  }

  private get pendingRoomLimit(): number {
    return ROOM_ADMISSION_PENDING_PER_SUBJECT_LIMIT * this.maxParticipants;
  }

  private add(socket: RoomAdmissionSocket): void {
    this.sockets.set(socket.socketId, socket);
    if (!socket.joined) {
      this.pending += 1;
      this.pendingBySubject.set(socket.subject, (this.pendingBySubject.get(socket.subject) ?? 0) + 1);
    }
  }

  private decrementPending(subject: string): void {
    this.pending -= 1;
    const next = (this.pendingBySubject.get(subject) ?? 1) - 1;
    if (next <= 0) this.pendingBySubject.delete(subject);
    else this.pendingBySubject.set(subject, next);
  }
}
