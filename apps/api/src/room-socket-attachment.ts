import {
  MAX_SESSION_ID_CHARS,
  ParticipantSchema,
  RoomCapabilitiesSchema,
  type Participant,
  type RoomCapabilities,
} from "@anidachi/protocol";
import type { VerifiedRoomToken } from "./auth";
import { ROOM_ADMISSION_JOIN_DEADLINE_MS } from "./room-admission";

export const ROOM_SOCKET_ATTACHMENT_VERSION = 3;

export interface RoomSocketVerifiedIdentity {
  avatarUrl?: string | null;
  capabilities?: RoomCapabilities;
  displayName?: string;
  participantSessionId: string;
  role: "host" | "member";
  roomId: string;
  sub: string;
}

export interface RoomSocketAttachment {
  admission: RoomSocketAdmission;
  connectedAt: number;
  lastSeenAt: number;
  participant?: Participant;
  participantSessionId?: string;
  roomId: string;
  schemaVersion: typeof ROOM_SOCKET_ATTACHMENT_VERSION;
  verified: RoomSocketVerifiedIdentity;
}

export interface RoomSocketAdmission {
  deadlineAt: number;
  joined: boolean;
}

export function createRoomSocketAttachment(
  roomId: string,
  verified: VerifiedRoomToken,
  now = Date.now(),
  admission: RoomSocketAdmission = {
    deadlineAt: now + ROOM_ADMISSION_JOIN_DEADLINE_MS,
    joined: false,
  },
): RoomSocketAttachment {
  return {
    admission,
    connectedAt: now,
    lastSeenAt: now,
    roomId,
    schemaVersion: ROOM_SOCKET_ATTACHMENT_VERSION,
    verified: serializeVerifiedRoomToken(verified),
  };
}

export function parseRoomSocketAttachment(
  value: unknown,
  expectedRoomId: string,
): RoomSocketAttachment | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.schemaVersion !== ROOM_SOCKET_ATTACHMENT_VERSION) {
    return null;
  }
  if (value.roomId !== expectedRoomId) {
    return null;
  }
  if (!isNonNegativeInteger(value.connectedAt) || !isNonNegativeInteger(value.lastSeenAt)) {
    return null;
  }

  const verified = parseVerifiedIdentity(value.verified, expectedRoomId);
  if (!verified) {
    return null;
  }

  const participant = value.participant === undefined
    ? undefined
    : ParticipantSchema.safeParse(value.participant);
  if (participant && !participant.success) {
    return null;
  }

  const admission = parseAdmission(value.admission);
  if (!admission || (admission.joined && !participant?.success)) {
    return null;
  }

  const attachment: RoomSocketAttachment = {
    admission,
    connectedAt: value.connectedAt,
    lastSeenAt: value.lastSeenAt,
    roomId: expectedRoomId,
    schemaVersion: ROOM_SOCKET_ATTACHMENT_VERSION,
    verified,
  };

  if (typeof value.participantSessionId === "string" && value.participantSessionId.length > 0) {
    attachment.participantSessionId = value.participantSessionId;
  }

  if (
    admission.joined &&
    attachment.participantSessionId !== verified.participantSessionId
  ) {
    return null;
  }

  if (participant?.success) {
    attachment.participant = participant.data;
  }

  return attachment;
}

export function attachmentToVerifiedRoomToken(
  attachment: RoomSocketAttachment,
): VerifiedRoomToken {
  const verified: VerifiedRoomToken = {
    avatarUrl: attachment.verified.avatarUrl ?? null,
    role: attachment.verified.role,
    participantSessionId: attachment.verified.participantSessionId,
    roomId: attachment.verified.roomId,
    sub: attachment.verified.sub,
  };
  if (attachment.verified.capabilities) {
    verified.capabilities = attachment.verified.capabilities;
  }
  if (attachment.verified.displayName) {
    verified.displayName = attachment.verified.displayName;
  }
  return verified;
}

export function updateRoomSocketAttachment(
  attachment: RoomSocketAttachment,
  patch: {
    lastSeenAt?: number;
    admission?: RoomSocketAdmission;
    participant?: Participant;
    participantSessionId?: string;
  },
): RoomSocketAttachment {
  const next: RoomSocketAttachment = {
    ...attachment,
    admission: patch.admission ?? attachment.admission,
    lastSeenAt: patch.lastSeenAt ?? Date.now(),
  };
  if (patch.participant) {
    next.participant = patch.participant;
  }
  if (patch.participantSessionId !== undefined) {
    next.participantSessionId = patch.participantSessionId;
  }
  return next;
}

function parseAdmission(value: unknown): RoomSocketAdmission | null {
  if (!isRecord(value)) return null;
  if (!isNonNegativeInteger(value.deadlineAt) || typeof value.joined !== "boolean") {
    return null;
  }
  return { deadlineAt: value.deadlineAt, joined: value.joined };
}

function serializeVerifiedRoomToken(verified: VerifiedRoomToken): RoomSocketVerifiedIdentity {
  const identity: RoomSocketVerifiedIdentity = {
    avatarUrl: verified.avatarUrl ?? null,
    role: verified.role,
    participantSessionId: verified.participantSessionId,
    roomId: verified.roomId,
    sub: verified.sub,
  };
  if (verified.capabilities) {
    identity.capabilities = verified.capabilities;
  }
  if (verified.displayName) {
    identity.displayName = verified.displayName;
  }
  return identity;
}

function parseVerifiedIdentity(
  value: unknown,
  expectedRoomId: string,
): RoomSocketVerifiedIdentity | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.roomId !== expectedRoomId) {
    return null;
  }
  if (typeof value.sub !== "string" || value.sub.length === 0) {
    return null;
  }
  if (value.role !== "host" && value.role !== "member") {
    return null;
  }
  if (
    typeof value.participantSessionId !== "string" ||
    value.participantSessionId.length === 0 ||
    value.participantSessionId.length > MAX_SESSION_ID_CHARS
  ) {
    return null;
  }
  if (
    value.avatarUrl !== undefined &&
    value.avatarUrl !== null &&
    typeof value.avatarUrl !== "string"
  ) {
    return null;
  }
  if (value.displayName !== undefined && typeof value.displayName !== "string") {
    return null;
  }

  const identity: RoomSocketVerifiedIdentity = {
    role: value.role,
    participantSessionId: value.participantSessionId,
    roomId: expectedRoomId,
    sub: value.sub,
  };
  if (value.avatarUrl !== undefined) {
    identity.avatarUrl = value.avatarUrl;
  }
  if (value.displayName) {
    identity.displayName = value.displayName;
  }
  if (value.capabilities !== undefined) {
    const capabilities = RoomCapabilitiesSchema.safeParse(value.capabilities);
    if (!capabilities.success) {
      return null;
    }
    identity.capabilities = capabilities.data;
  }
  return identity;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
