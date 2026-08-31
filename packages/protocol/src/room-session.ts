import { z } from "zod";
import {
  MAX_PARTICIPANT_ID_CHARS,
  MAX_ROOM_ID_CHARS,
  MAX_SESSION_ID_CHARS,
  MAX_WATCH_TITLE_CHARS,
} from "./limits";
import { WatchSourceProviderSchema } from "./types";

const RoomIdSchema = z.string().min(1).max(MAX_ROOM_ID_CHARS);
const ParticipantIdSchema = z.string().min(1).max(MAX_PARTICIPANT_ID_CHARS);
const ParticipantSessionIdSchema = z.string().min(1).max(MAX_SESSION_ID_CHARS);

export const ROOM_DISCONNECT_GRACE_MS = 60_000;
/** Hard platform budget for the Web admission route. */
export const ROOM_CONNECT_ROUTE_MAX_DURATION_SECONDS = 60;
/** Client-side bound before a room admission request is aborted. */
export const ROOM_CONNECT_REQUEST_TIMEOUT_MS = 60_000;
export const ROOM_TOKEN_ISSUER = "anidachi-auth";
export const ROOM_TOKEN_AUDIENCE = "anidachi-worker";

export const ActiveRoomRoleSchema = z.enum(["host", "member"]);

export const RoomSessionAdmissionInputSchema = z.strictObject({
  participantSessionId: ParticipantSessionIdSchema,
});

export const ActiveRoomConflictResponseSchema = z.strictObject({
  code: z.literal("ACTIVE_ROOM_CONFLICT"),
  message: z.string().min(1).max(300),
  activeRoom: z.strictObject({
    roomId: RoomIdSchema,
    role: ActiveRoomRoleSchema,
    provider: WatchSourceProviderSchema.nullable(),
    title: z.string().min(1).max(MAX_WATCH_TITLE_CHARS).nullable(),
  }),
});

export const RoomDepartureRequestSchema = z.strictObject({
  participantSessionId: ParticipantSessionIdSchema,
});

export const ActiveRoomRecoveryRequestSchema = z.strictObject({
	roomId: RoomIdSchema,
});

export const InternalRoomDepartureCommandSchema = z.strictObject({
  roomId: RoomIdSchema,
  userId: ParticipantIdSchema,
  participantSessionId: ParticipantSessionIdSchema,
  requestedAt: z.number().int().nonnegative(),
});

export const InternalRoomDetachCommandSchema = z.strictObject({
  roomId: RoomIdSchema,
  userId: ParticipantIdSchema,
  participantSessionId: ParticipantSessionIdSchema,
  requestedAt: z.number().int().nonnegative(),
});

export const RoomDepartureCallbackSchema = z.strictObject({
  roomId: RoomIdSchema,
  userId: ParticipantIdSchema,
  participantSessionId: ParticipantSessionIdSchema,
  departedAt: z.number().int().nonnegative(),
});

export const RoomDepartureAcknowledgementSchema = z.strictObject({
  ok: z.literal(true),
  outcome: z.enum(["departed", "room_ended", "already_departed", "stale"]),
});

export const RoomDetachAcknowledgementSchema = z.strictObject({
  ok: z.literal(true),
  outcome: z.enum(["detached", "stale"]),
});

const RoomDepartureErrorMessageSchema = z.string().min(1).max(300);

export const RoomDepartureErrorResponseSchema = z.discriminatedUnion("code", [
  z.strictObject({
    code: z.literal("AUTH_REQUIRED"),
    message: RoomDepartureErrorMessageSchema,
  }),
  z.strictObject({
    code: z.literal("ACTIVE_ROOM_CHANGED"),
    message: RoomDepartureErrorMessageSchema,
  }),
  z.strictObject({
    code: z.literal("ROOM_DEPARTURE_UNAVAILABLE"),
    message: RoomDepartureErrorMessageSchema,
    retryable: z.literal(true),
  }),
]);

export type ActiveRoomRole = z.infer<typeof ActiveRoomRoleSchema>;
export type RoomSessionAdmissionInput = z.infer<typeof RoomSessionAdmissionInputSchema>;
export type ActiveRoomConflictResponse = z.infer<typeof ActiveRoomConflictResponseSchema>;
export type RoomDepartureRequest = z.infer<typeof RoomDepartureRequestSchema>;
export type ActiveRoomRecoveryRequest = z.infer<
	typeof ActiveRoomRecoveryRequestSchema
>;
export type InternalRoomDepartureCommand = z.infer<
	typeof InternalRoomDepartureCommandSchema
>;
export type InternalRoomDetachCommand = z.infer<
  typeof InternalRoomDetachCommandSchema
>;
export type RoomDepartureCallback = z.infer<typeof RoomDepartureCallbackSchema>;
export type RoomDepartureAcknowledgement = z.infer<typeof RoomDepartureAcknowledgementSchema>;
export type RoomDetachAcknowledgement = z.infer<
  typeof RoomDetachAcknowledgementSchema
>;
export type RoomDepartureErrorResponse = z.infer<
  typeof RoomDepartureErrorResponseSchema
>;
