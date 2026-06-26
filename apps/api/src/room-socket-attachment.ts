import {
  ParticipantSchema,
  RoomCapabilitiesSchema,
  type Participant,
  type RoomCapabilities,
} from "@anidachi/protocol";
import type { VerifiedRoomToken } from "./auth";

export const ROOM_SOCKET_ATTACHMENT_VERSION = 1;

export interface RoomSocketVerifiedIdentity {
  avatarUrl?: string | null;
  capabilities?: RoomCapabilities;
  displayName?: string;
  role: "host" | "member";
  roomId: string;
  sub: string;
}

export interface RoomSocketAttachment {
  connectedAt: number;
  lastSeenAt: number;
  participant?: Participant;
  participantSessionId?: string;
  roomId: string;
  schemaVersion: typeof ROOM_SOCKET_ATTACHMENT_VERSION;
  verified: RoomSocketVerifiedIdentity;
}

export function createRoomSocketAttachment(
  roomId: string,
  verified: VerifiedRoomToken,
  now = Date.now(),
): RoomSocketAttachment {
  return {
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

  const attachment: RoomSocketAttachment = {
    connectedAt: value.connectedAt,
    lastSeenAt: value.lastSeenAt,
    roomId: expectedRoomId,
    schemaVersion: ROOM_SOCKET_ATTACHMENT_VERSION,
    verified,
  };

  if (typeof value.participantSessionId === "string" && value.participantSessionId.length > 0) {
    attachment.participantSessionId = value.participantSessionId;
  }

  if (value.participant !== undefined) {
    const participant = ParticipantSchema.safeParse(value.participant);
    if (!participant.success) {
      return null;
    }
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
    participant?: Participant;
    participantSessionId?: string;
  },
): RoomSocketAttachment {
  const next: RoomSocketAttachment = {
    ...attachment,
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

function serializeVerifiedRoomToken(verified: VerifiedRoomToken): RoomSocketVerifiedIdentity {
  const identity: RoomSocketVerifiedIdentity = {
    avatarUrl: verified.avatarUrl ?? null,
    role: verified.role,
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
