import { z } from "zod";
import {
  MAX_DISPLAY_NAME_CHARS,
  MAX_ICE_CANDIDATE_BYTES,
  MAX_PARTICIPANT_ID_CHARS,
  MAX_ROOM_ID_CHARS,
  MAX_SDP_BYTES,
  MAX_SESSION_ID_CHARS,
  MAX_REACTION_EMOJI_CHARS,
  MAX_URL_CHARS,
  MAX_VIDEO_FINGERPRINT_CHARS,
  MAX_WATCH_TITLE_CHARS,
} from "./limits";

const RoomIdSchema = z.string().min(1).max(MAX_ROOM_ID_CHARS);
const ParticipantIdSchema = z.string().min(1).max(MAX_PARTICIPANT_ID_CHARS);
const SessionIdSchema = z.string().min(1).max(MAX_SESSION_ID_CHARS);
const VideoFingerprintSchema = z.string().min(1).max(MAX_VIDEO_FINGERPRINT_CHARS);
const UrlSchema = z.string().max(MAX_URL_CHARS).url();
const textEncoder = new TextEncoder();

function boundedUtf8String(maxBytes: number) {
  return z
    .string()
    .min(1)
    .max(maxBytes)
    .refine((value) => textEncoder.encode(value).byteLength <= maxBytes, {
      message: `String exceeds ${maxBytes} UTF-8 bytes`,
    });
}

export const ParticipantSchema = z.object({
  id: ParticipantIdSchema,
  displayName: z.string().min(1).max(MAX_DISPLAY_NAME_CHARS),
  avatarUrl: UrlSchema.optional(),
  role: z.enum(["host", "viewer"]),
  mediaSeat: z.enum(["none", "joined", "requested"]).default("none"),
  mediaSeatSource: z.enum(["auto", "host"]).optional(),
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
  videoFingerprint: VideoFingerprintSchema,
  sourceUrl: UrlSchema.optional(),
  playing: z.boolean(),
  hostTime: z.number().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  playbackRate: z.number().positive(),
});

export const WatchSourceProviderSchema = z.enum(["crunchyroll", "youtube", "generic"]);

export const WatchSourceDescriptorSchema = z.object({
  provider: WatchSourceProviderSchema,
  sourceUrl: UrlSchema,
  canonicalUrl: UrlSchema,
  videoFingerprint: VideoFingerprintSchema,
  title: z.string().min(1).max(MAX_WATCH_TITLE_CHARS),
  seriesTitle: z.string().min(1).max(MAX_WATCH_TITLE_CHARS).optional(),
  episodeTitle: z.string().min(1).max(MAX_WATCH_TITLE_CHARS).optional(),
  seasonNumber: z.number().int().positive().optional(),
  episodeNumber: z.number().int().nonnegative().optional(),
  duration: z.number().nonnegative().optional(),
  posterUrl: UrlSchema.optional(),
});

export const ReactionEventSchema = z
  .object({
    id: SessionIdSchema,
    userId: ParticipantIdSchema,
    roomId: RoomIdSchema,
    emoji: z.string().min(1).max(MAX_REACTION_EMOJI_CHARS).optional(),
    effect: z.enum(["atomic-fire"]).optional(),
    text: z.string().min(1).max(140).optional(),
    videoTime: z.number().nonnegative(),
    createdAt: z.number().int().nonnegative(),
  })
  .refine((reaction) => reaction.emoji || reaction.text, {
    message: "Reaction requires emoji or text",
  });

const RoomScopedSchema = z.object({
  roomId: RoomIdSchema,
});

export const P2PSessionDescriptionSchema = z.object({
  type: z.enum(["offer", "answer"]),
  sdp: boundedUtf8String(MAX_SDP_BYTES),
});

export const P2PIceCandidateSchema = z.object({
  candidate: boundedUtf8String(MAX_ICE_CANDIDATE_BYTES),
  sdpMid: SessionIdSchema.nullable().optional(),
  sdpMLineIndex: z.number().int().nullable().optional(),
  usernameFragment: SessionIdSchema.nullable().optional(),
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

const ClientP2PSignalEnvelopeSchema = RoomScopedSchema.extend({
  type: z.literal("P2P_SIGNAL"),
  clientSignalId: SessionIdSchema,
  fromUserId: ParticipantIdSchema,
  // Compatibility bridge: clients may send their current generation hints, but
  // the Worker owns the authoritative values and rewrites them on relay.
  roomGeneration: z.number().int().nonnegative().optional(),
  senderConnectionId: SessionIdSchema,
  sourceGeneration: z.number().int().nonnegative().optional(),
  toUserId: ParticipantIdSchema,
  signal: P2PSignalSchema,
});

const ServerP2PSignalEnvelopeSchema = ClientP2PSignalEnvelopeSchema.extend({
  roomGeneration: z.number().int().nonnegative(),
  serverReceivedAt: z.number().int().nonnegative(),
  serverSeq: z.number().int().nonnegative(),
  sourceGeneration: z.number().int().nonnegative(),
});

export const ClientEventSchema = z.discriminatedUnion("type", [
  RoomScopedSchema.extend({
    type: z.literal("PING"),
    sentAt: z.number().int().nonnegative(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("JOIN"),
    participant: ParticipantSchema,
    videoFingerprint: VideoFingerprintSchema,
    lastSeenP2PServerSeq: z.number().int().nonnegative().optional(),
    // Stable id for one overlay/tab room session. Lets the Worker tell a
    // reconnect of the same session apart from a takeover by a different
    // tab/device (one active session, owner decision 2026-06-13).
    participantSessionId: SessionIdSchema.optional(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("HOST_STATE"),
    state: PlaybackStateSchema,
    source: WatchSourceDescriptorSchema.optional(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("PLAY"),
    byUserId: ParticipantIdSchema,
    at: z.number().nonnegative(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("PAUSE"),
    byUserId: ParticipantIdSchema,
    at: z.number().nonnegative(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("SEEK"),
    byUserId: ParticipantIdSchema,
    to: z.number().nonnegative(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("REACTION"),
    reaction: ReactionEventSchema,
  }),
  RoomScopedSchema.extend({
    type: z.literal("CAMERA_ON"),
    userId: ParticipantIdSchema,
  }),
  RoomScopedSchema.extend({
    type: z.literal("CAMERA_OFF"),
    userId: ParticipantIdSchema,
  }),
  RoomScopedSchema.extend({
    type: z.literal("MEDIA_JOIN_REQUEST"),
    userId: ParticipantIdSchema,
  }),
  RoomScopedSchema.extend({
    type: z.literal("MEDIA_JOIN_CANCEL"),
    userId: ParticipantIdSchema,
  }),
  RoomScopedSchema.extend({
    type: z.literal("MEDIA_SEAT_LEAVE"),
    userId: ParticipantIdSchema,
  }),
  RoomScopedSchema.extend({
    type: z.literal("MEDIA_SEAT_GRANT"),
    targetUserId: ParticipantIdSchema,
  }),
  RoomScopedSchema.extend({
    type: z.literal("MEDIA_SEAT_REVOKE"),
    targetUserId: ParticipantIdSchema,
  }),
  ClientP2PSignalEnvelopeSchema,
]).superRefine((event, context) => {
  if (event.type === "REACTION" && event.reaction.roomId !== event.roomId) {
    context.addIssue({
      code: "custom",
      message: "Reaction room must match event room",
      path: ["reaction", "roomId"],
    });
  }
});

export const ServerEventSchema = z.discriminatedUnion("type", [
  RoomScopedSchema.extend({
    type: z.literal("PONG"),
    sentAt: z.number().int().nonnegative(),
    serverTime: z.number().int().nonnegative(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("ROOM_SNAPSHOT"),
    roomGeneration: z.number().int().nonnegative(),
    serverSeq: z.number().int().nonnegative(),
    sourceGeneration: z.number().int().nonnegative(),
    participants: z.array(ParticipantSchema),
    capabilities: RoomCapabilitiesSchema.optional(),
    hostState: PlaybackStateSchema.optional(),
    source: WatchSourceDescriptorSchema.optional(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("SOURCE_CHANGED"),
    roomGeneration: z.number().int().nonnegative(),
    sourceGeneration: z.number().int().nonnegative(),
    serverSeq: z.number().int().nonnegative(),
    serverReceivedAt: z.number().int().nonnegative(),
    source: WatchSourceDescriptorSchema,
    previousSource: WatchSourceDescriptorSchema.optional(),
    hostState: PlaybackStateSchema,
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
    byUserId: ParticipantIdSchema,
    at: z.number().nonnegative(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("PAUSE"),
    byUserId: ParticipantIdSchema,
    at: z.number().nonnegative(),
  }),
  RoomScopedSchema.extend({
    type: z.literal("SEEK"),
    byUserId: ParticipantIdSchema,
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
  ServerP2PSignalEnvelopeSchema,
]);

export type Participant = z.infer<typeof ParticipantSchema>;
export type RoomCapabilities = z.infer<typeof RoomCapabilitiesSchema>;
export type PlaybackState = z.infer<typeof PlaybackStateSchema>;
export type WatchSourceDescriptor = z.infer<typeof WatchSourceDescriptorSchema>;
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
