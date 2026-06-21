import { z } from "zod";

export const ParticipantSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  role: z.enum(["host", "viewer"]),
  cameraEnabled: z.boolean(),
  syncStatus: z.enum(["synced", "behind", "buffering", "unknown"]),
  lastSeenAt: z.number().int().nonnegative(),
});

const CanonicalPlanCodeSchema = z.enum(["free", "plus", "pro"]);
const LegacyPlanCodeSchema = z.enum(["watcher", "nakama", "junkie"]);

export const RoomCapabilitiesSchema = z.object({
  hostPlanCode: z.union([CanonicalPlanCodeSchema, LegacyPlanCodeSchema]).transform((value) => {
    if (value === "watcher") return "free";
    if (value === "nakama") return "plus";
    if (value === "junkie") return "pro";
    return value;
  }),
  maxParticipants: z.number().int().min(1).max(50),
  maxMediaSeats: z.number().int().min(0).max(16),
  canNameRoom: z.boolean(),
  canSendPushInvites: z.boolean(),
});

export const PlaybackStateSchema = z.object({
  videoFingerprint: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  playing: z.boolean(),
  hostTime: z.number().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  playbackRate: z.number().positive(),
});

export const ReactionEventSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    roomId: z.string().min(1),
    emoji: z.string().min(1).optional(),
    effect: z.enum(["atomic-fire"]).optional(),
    text: z.string().min(1).max(140).optional(),
    videoTime: z.number().nonnegative(),
    createdAt: z.number().int().nonnegative(),
  })
  .refine((reaction) => reaction.emoji || reaction.text, {
    message: "Reaction requires emoji or text",
  });

const RoomScopedSchema = z.object({
  roomId: z.string().min(1),
});

export const P2PSessionDescriptionSchema = z.object({
  type: z.enum(["offer", "answer"]),
  sdp: z.string().min(1),
});

export const P2PIceCandidateSchema = z.object({
  candidate: z.string().min(1),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.number().int().nullable().optional(),
  usernameFragment: z.string().nullable().optional(),
});

export const P2PSignalSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("offer"),
    sdp: P2PSessionDescriptionSchema.extend({ type: z.literal("offer") }),
  }),
  z.object({
    kind: z.literal("answer"),
    sdp: P2PSessionDescriptionSchema.extend({ type: z.literal("answer") }),
  }),
  z.object({
    kind: z.literal("ice"),
    candidate: P2PIceCandidateSchema,
  }),
  z.object({
    kind: z.literal("voice-start"),
  }),
  z.object({
    kind: z.literal("voice-stop"),
  }),
  z.object({
    kind: z.literal("renegotiate"),
  }),
  z.object({
    kind: z.literal("restart-ice"),
  }),
  z.object({
    kind: z.literal("bye"),
  }),
]);

const P2PSignalEnvelopeSchema = RoomScopedSchema.extend({
  type: z.literal("P2P_SIGNAL"),
  clientSignalId: z.string().min(1),
  fromUserId: z.string().min(1),
  roomGeneration: z.number().int().nonnegative().optional(),
  senderConnectionId: z.string().min(1),
  serverReceivedAt: z.number().int().nonnegative().optional(),
  serverSeq: z.number().int().nonnegative().optional(),
  sourceGeneration: z.number().int().nonnegative().optional(),
  toUserId: z.string().min(1),
  signal: P2PSignalSchema,
});

export const ClientEventSchema = z.discriminatedUnion("type", [
  RoomScopedSchema.extend({
    type: z.literal("PING"),
    sentAt: z.number().int().nonnegative(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("JOIN"),
    participant: ParticipantSchema,
    videoFingerprint: z.string().min(1),
    lastSeenP2PServerSeq: z.number().int().nonnegative().optional(),
    // Stable id for one overlay/tab room session. Lets the Worker tell a
    // reconnect of the same session apart from a takeover by a different
    // tab/device (one active session, owner decision 2026-06-13).
    participantSessionId: z.string().min(1).optional(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("HOST_STATE"),
    state: PlaybackStateSchema,
  }),
  RoomScopedSchema.extend({
    type: z.literal("PLAY"),
    byUserId: z.string().min(1),
    at: z.number().nonnegative(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("PAUSE"),
    byUserId: z.string().min(1),
    at: z.number().nonnegative(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("SEEK"),
    byUserId: z.string().min(1),
    to: z.number().nonnegative(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("REACTION"),
    reaction: ReactionEventSchema,
  }),
  RoomScopedSchema.extend({
    type: z.literal("CAMERA_ON"),
    userId: z.string().min(1),
  }),
  RoomScopedSchema.extend({
    type: z.literal("CAMERA_OFF"),
    userId: z.string().min(1),
  }),
  P2PSignalEnvelopeSchema,
]);

export const ServerEventSchema = z.discriminatedUnion("type", [
  RoomScopedSchema.extend({
    type: z.literal("PONG"),
    sentAt: z.number().int().nonnegative(),
    serverTime: z.number().int().nonnegative(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("ROOM_SNAPSHOT"),
    participants: z.array(ParticipantSchema),
    capabilities: RoomCapabilitiesSchema.optional(),
    hostState: PlaybackStateSchema.optional(),
  }),
  z.object({
    type: z.literal("PARTICIPANT_JOINED"),
    participant: ParticipantSchema,
  }),
  z.object({
    type: z.literal("PARTICIPANT_LEFT"),
    participant: ParticipantSchema,
  }),
  z.object({
    type: z.literal("HOST_STATE"),
    state: PlaybackStateSchema,
  }),
  RoomScopedSchema.extend({
    type: z.literal("PLAY"),
    byUserId: z.string().min(1),
    at: z.number().nonnegative(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("PAUSE"),
    byUserId: z.string().min(1),
    at: z.number().nonnegative(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("SEEK"),
    byUserId: z.string().min(1),
    to: z.number().nonnegative(),
  }),
  z.object({
    type: z.literal("REACTION"),
    reaction: ReactionEventSchema,
  }),
  z.object({
    type: z.literal("ERROR"),
    code: z.string().min(1),
    message: z.string().min(1),
  }),
  P2PSignalEnvelopeSchema,
]);

export type Participant = z.infer<typeof ParticipantSchema>;
export type RoomCapabilities = z.infer<typeof RoomCapabilitiesSchema>;
export type PlaybackState = z.infer<typeof PlaybackStateSchema>;
export type ReactionEvent = z.infer<typeof ReactionEventSchema>;
export type P2PSessionDescription = z.infer<typeof P2PSessionDescriptionSchema>;
export type P2PIceCandidate = z.infer<typeof P2PIceCandidateSchema>;
export type P2PSignal = z.infer<typeof P2PSignalSchema>;
export type ClientEvent = z.infer<typeof ClientEventSchema>;
export type ServerEvent = z.infer<typeof ServerEventSchema>;

export function parseClientEvent(value: unknown): ClientEvent {
  return ClientEventSchema.parse(value);
}

export function parseServerEvent(value: unknown): ServerEvent {
  return ServerEventSchema.parse(value);
}
