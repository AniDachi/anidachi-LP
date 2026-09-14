import { z } from "zod";
import { getPlanPolicy, PlanCodeSchema } from "./commercial-policy";
import {
	MAX_ROOM_ID_CHARS,
	MAX_SESSION_ID_CHARS,
	MAX_PARTICIPANT_ID_CHARS,
} from "./limits";

const SessionId = z.string().trim().min(1).max(MAX_SESSION_ID_CHARS);
const RoomId = z.string().trim().min(1).max(MAX_ROOM_ID_CHARS);
const Generation = z.number().int().positive();
const Sequence = z.number().int().nonnegative();
const Timestamp = z.iso.datetime({ offset: true });
const scope = { roomId: RoomId, roomGeneration: Generation };
const participantScope = { ...scope, participantSessionId: SessionId };
export const ROOM_MEDIA_CAPABILITY_LEASE_MS = 30 * 60 * 1000;
export const ROOM_MEDIA_CAPABILITY_RENEW_BEFORE_MS = 5 * 60 * 1000;
export const ROOM_MEDIA_CAPABILITY_END_GRACE_MS = 5 * 60 * 1000;
export const RoomMediaKindSchema = z.enum(["camera", "microphone"]);
export const ParticipantMediaV2StateSchema = z.strictObject({
	cameraRevocationEpoch: Sequence.default(0),
	microphoneRevocationEpoch: Sequence.default(0),
	cameraGranted: z.boolean(),
	microphoneGranted: z.boolean(),
	cameraIntentSequence: Sequence,
	microphoneIntentSequence: Sequence,
});
export const MediaIntentSchema = z.strictObject({
	type: z.literal("SET_MEDIA_INTENT"),
	...participantScope,
	media: RoomMediaKindSchema,
	enabled: z.boolean(),
	revocationEpoch: Sequence.default(0),
	requestId: SessionId,
	intentSequence: z.number().int().positive(),
});
/** Worker must authenticate the host separately; this shape does not grant authority. */
export const HostMediaRevokeSchema = z.strictObject({
	type: z.literal("REVOKE_MEDIA_GRANT"),
	...scope,
	targetParticipantSessionId: SessionId,
	requestId: SessionId,
	media: RoomMediaKindSchema,
});
export const RoomMediaV2CapabilitiesSchema = z
	.strictObject({
		mediaProtocolVersion: z.literal(2),
		hostPlanCode: PlanCodeSchema,
		maxParticipants: z.union([z.literal(4), z.literal(6), z.literal(15)]),
		maxCameras: z.literal(4),
		maxMicrophones: z.union([z.literal(4), z.literal(6), z.literal(8)]),
		capabilityRevision: Generation,
		capabilitiesValidUntil: Timestamp,
	})
	.superRefine((caps, ctx) => {
		const policy = getPlanPolicy(caps.hostPlanCode);
		for (const key of [
			"maxParticipants",
			"maxCameras",
			"maxMicrophones",
		] as const)
			if (caps[key] !== policy[key])
				ctx.addIssue({
					code: "custom",
					path: [key],
					message: "Room caps must match their frozen host plan",
				});
	});
/** Server-issued token claims only, not an unauthenticated client event.
 * Frozen hostPlanCode/caps survive upgrade; renewal verifies current authority.
 */
export const RoomMediaV2CapabilityLeaseSchema = z
	.strictObject({
		...scope,
		issuedAt: Timestamp,
		paidUntil: Timestamp.nullable(),
		capabilities: RoomMediaV2CapabilitiesSchema,
	})
	.superRefine((lease, ctx) => {
		const issued = Date.parse(lease.issuedAt),
			expiry = Date.parse(lease.capabilities.capabilitiesValidUntil);
		if (
			expiry <= issued ||
			expiry > issued + ROOM_MEDIA_CAPABILITY_LEASE_MS ||
			(lease.paidUntil !== null && expiry > Date.parse(lease.paidUntil))
		)
			ctx.addIssue({
				code: "custom",
				path: ["capabilities", "capabilitiesValidUntil"],
				message: "Capability lease exceeds server authority",
			});
	});
const reply = {
	...participantScope,
	media: RoomMediaKindSchema,
	requestId: SessionId,
	intentSequence: z.number().int().positive(),
	snapshotSequence: Sequence,
	state: ParticipantMediaV2StateSchema,
};
/** Ack state includes the last accepted sequence. Duplicate/stale requests return
 * current state; consumers must fence by room/session and snapshotSequence.
 */
export const MediaV2IntentAckSchema = z
	.strictObject({ type: z.literal("MEDIA_INTENT_ACK"), ...reply })
	.superRefine((ack, ctx) => {
		const sequence =
			ack.media === "camera"
				? ack.state.cameraIntentSequence
				: ack.state.microphoneIntentSequence;
		if (sequence < ack.intentSequence)
			ctx.addIssue({
				code: "custom",
				path: ["state"],
				message: "Ack cannot precede its intent",
			});
	});
export const MediaV2IntentErrorSchema = z.strictObject({
	type: z.literal("MEDIA_INTENT_ERROR"),
	...reply,
	code: z.enum([
		"MEDIA_LIMIT_REACHED",
		"MEDIA_STALE_GENERATION",
		"MEDIA_STALE_SESSION",
		"MEDIA_STALE_INTENT",
		"MEDIA_CAPABILITY_EXPIRED",
		"MEDIA_FORBIDDEN",
	]),
});
export const RoomMediaV2SnapshotSchema = z
	.strictObject({
		type: z.literal("ROOM_MEDIA_SNAPSHOT"),
		...scope,
		snapshotSequence: Sequence,
		capabilities: RoomMediaV2CapabilitiesSchema,
		participants: z
			.array(
				ParticipantMediaV2StateSchema.extend({
					participantSessionId: SessionId,
				}),
			)
			.max(15),
		// Once set on entitlement loss/expiry, reconnect must never move this deadline.
		closingAt: Timestamp.nullable(),
	})
	.superRefine((snapshot, ctx) => {
		const participants = snapshot.participants;
		if (
			new Set(participants.map((p) => p.participantSessionId)).size !==
			participants.length
		)
			ctx.addIssue({
				code: "custom",
				path: ["participants"],
				message: "Participant sessions must be unique",
			});
		if (
			participants.length > snapshot.capabilities.maxParticipants ||
			participants.filter((p) => p.cameraGranted).length >
				snapshot.capabilities.maxCameras ||
			participants.filter((p) => p.microphoneGranted).length >
				snapshot.capabilities.maxMicrophones
		)
			ctx.addIssue({
				code: "custom",
				path: ["participants"],
				message: "Room publication or participant capacity exceeded",
			});
	});
export type RoomMediaKind = z.infer<typeof RoomMediaKindSchema>;
export type MediaIntent = z.infer<typeof MediaIntentSchema>;
export type HostMediaRevoke = z.infer<typeof HostMediaRevokeSchema>;
export type ParticipantMediaV2State = z.infer<
	typeof ParticipantMediaV2StateSchema
>;
export type RoomMediaV2Capabilities = z.infer<
	typeof RoomMediaV2CapabilitiesSchema
>;
export type RoomMediaV2CapabilityLease = z.infer<
	typeof RoomMediaV2CapabilityLeaseSchema
>;
export type MediaV2IntentAck = z.infer<typeof MediaV2IntentAckSchema>;
export type MediaV2IntentError = z.infer<typeof MediaV2IntentErrorSchema>;
export type RoomMediaV2Snapshot = z.infer<typeof RoomMediaV2SnapshotSchema>;
/** Inputs must be actual current members, selected by authenticated Worker state.
 * Grant enables publication, never requires receivers to call getUserMedia.
 */
export function isRoomMediaPairAllowed(
	a: Pick<ParticipantMediaV2State, "cameraGranted" | "microphoneGranted"> & {
		roomId: string;
		roomGeneration: number;
		participantSessionId: string;
	},
	b: Pick<ParticipantMediaV2State, "cameraGranted" | "microphoneGranted"> & {
		roomId: string;
		roomGeneration: number;
		participantSessionId: string;
	},
): boolean {
	return (
		a.roomId === b.roomId &&
		a.roomGeneration === b.roomGeneration &&
		a.participantSessionId !== b.participantSessionId &&
		(a.cameraGranted ||
			a.microphoneGranted ||
			b.cameraGranted ||
			b.microphoneGranted)
	);
}

/** v3 replaces the independent microphone quota with host-managed seats. */
export const RoomMediaV3CapabilitiesSchema = z
	.strictObject({
		mediaProtocolVersion: z.literal(3),
		hostPlanCode: PlanCodeSchema,
		maxParticipants: z.union([z.literal(4), z.literal(6), z.literal(15)]),
		maxMediaSeats: z.union([z.literal(4), z.literal(6), z.literal(8)]),
		maxCameras: z.literal(4),
		capabilityRevision: Generation,
		capabilitiesValidUntil: Timestamp,
	})
	.superRefine((caps, ctx) => {
		const policy = getPlanPolicy(caps.hostPlanCode);
		if (caps.maxParticipants !== policy.maxParticipants)
			ctx.addIssue({
				code: "custom",
				path: ["maxParticipants"],
				message: "Room caps must match their frozen host plan",
			});
		if (caps.maxMediaSeats !== policy.maxMicrophones)
			ctx.addIssue({
				code: "custom",
				path: ["maxMediaSeats"],
				message: "Room seats must match their frozen host plan",
			});
	});
export const ParticipantMediaV3StateSchema =
	ParticipantMediaV2StateSchema.extend({
		mediaSeatGranted: z.boolean(),
		seatRevision: Sequence,
	}).superRefine((state, ctx) => {
		if (
			(state.cameraGranted || state.microphoneGranted) &&
			!state.mediaSeatGranted
		)
			ctx.addIssue({
				code: "custom",
				path: ["mediaSeatGranted"],
				message: "Publication requires a media seat",
			});
	});
/** Worker authenticates host authority and matches the target user/session before applying. */
export const SetMediaSeatSchema = z.strictObject({
	type: z.literal("SET_MEDIA_SEAT"),
	...scope,
	targetUserId: z.string().trim().min(1).max(MAX_PARTICIPANT_ID_CHARS),
	targetParticipantSessionId: SessionId,
	expectedSeatRevision: Sequence,
	enabled: z.boolean(),
	requestId: SessionId,
});
export const RoomMediaCapabilitiesSchema = z.discriminatedUnion(
	"mediaProtocolVersion",
	[RoomMediaV2CapabilitiesSchema, RoomMediaV3CapabilitiesSchema],
);
export const ParticipantMediaStateSchema = z.union([
	ParticipantMediaV2StateSchema,
	ParticipantMediaV3StateSchema,
]);
export const RoomMediaV3CapabilityLeaseSchema = z
	.strictObject({
		...scope,
		issuedAt: Timestamp,
		paidUntil: Timestamp.nullable(),
		capabilities: RoomMediaV3CapabilitiesSchema,
	})
	.superRefine((lease, ctx) => {
		const issued = Date.parse(lease.issuedAt),
			expiry = Date.parse(lease.capabilities.capabilitiesValidUntil);
		if (
			expiry <= issued ||
			expiry > issued + ROOM_MEDIA_CAPABILITY_LEASE_MS ||
			(lease.paidUntil !== null && expiry > Date.parse(lease.paidUntil))
		)
			ctx.addIssue({
				code: "custom",
				path: ["capabilities", "capabilitiesValidUntil"],
				message: "Capability lease exceeds server authority",
			});
	});
export const RoomMediaCapabilityLeaseSchema = z.union([
	RoomMediaV2CapabilityLeaseSchema,
	RoomMediaV3CapabilityLeaseSchema,
]);
export const MediaV3IntentAckSchema = MediaV2IntentAckSchema.safeExtend({
	state: ParticipantMediaV3StateSchema,
});
export const MediaV3IntentErrorSchema = MediaV2IntentErrorSchema.extend({
	state: ParticipantMediaV3StateSchema,
	code: MediaV2IntentErrorSchema.shape.code.or(
		z.literal("MEDIA_SEAT_REQUIRED"),
	),
});
// Each outer event retains one literal discriminator; only the nested state is a union.
export const MediaIntentAckSchema = MediaV2IntentAckSchema.safeExtend({
	state: ParticipantMediaStateSchema,
});
export const MediaIntentErrorSchema = MediaV2IntentErrorSchema.extend({
	state: ParticipantMediaStateSchema,
	code: MediaV3IntentErrorSchema.shape.code,
}).superRefine((error, ctx) => {
	if (
		error.code === "MEDIA_SEAT_REQUIRED" &&
		!("mediaSeatGranted" in error.state)
	)
		ctx.addIssue({
			code: "custom",
			path: ["code"],
			message: "Media seats require protocol v3 state",
		});
});
export const RoomMediaV3SnapshotSchema = z
	.strictObject({
		type: z.literal("ROOM_MEDIA_SNAPSHOT"),
		...scope,
		snapshotSequence: Sequence,
		capabilities: RoomMediaV3CapabilitiesSchema,
		participants: z
			.array(
				ParticipantMediaV3StateSchema.safeExtend({
					participantSessionId: SessionId,
				}),
			)
			.max(15),
		closingAt: Timestamp.nullable(),
	})
	.superRefine((snapshot, ctx) => {
		const ps = snapshot.participants;
		if (new Set(ps.map((p) => p.participantSessionId)).size !== ps.length)
			ctx.addIssue({
				code: "custom",
				path: ["participants"],
				message: "Participant sessions must be unique",
			});
		if (
			ps.length > snapshot.capabilities.maxParticipants ||
			ps.filter((p) => p.mediaSeatGranted).length >
				snapshot.capabilities.maxMediaSeats ||
			ps.filter((p) => p.cameraGranted).length >
				snapshot.capabilities.maxCameras
		)
			ctx.addIssue({
				code: "custom",
				path: ["participants"],
				message: "Room seat, camera or participant capacity exceeded",
			});
	});
/** The object input preserves one discriminator for ServerEventSchema; the
 * versioned transform rejects mixed shapes and returns the exact snapshot union. */
export const RoomMediaSnapshotSchema = z
	.strictObject({
		type: z.literal("ROOM_MEDIA_SNAPSHOT"),
		...scope,
		snapshotSequence: Sequence,
		capabilities: RoomMediaCapabilitiesSchema,
		participants: z
			.array(
				z.union([
					ParticipantMediaV2StateSchema.extend({
						participantSessionId: SessionId,
					}),
					ParticipantMediaV3StateSchema.safeExtend({
						participantSessionId: SessionId,
					}),
				]),
			)
			.max(15),
		closingAt: Timestamp.nullable(),
	})
	.transform((snapshot, ctx) => {
		const result = z
			.union([RoomMediaV2SnapshotSchema, RoomMediaV3SnapshotSchema])
			.safeParse(snapshot);
		if (result.success) return result.data;
		for (const issue of result.error.issues)
			ctx.addIssue({
				code: "custom",
				path: issue.path,
				message: issue.message,
			});
		return z.NEVER;
	});
export const MediaSeatResultCodeSchema = z.enum([
	"OK",
	"MEDIA_FORBIDDEN",
	"MEDIA_LIMIT_REACHED",
	"MEDIA_STALE_SESSION",
	"MEDIA_STALE_GENERATION",
	"MEDIA_STALE_SEAT_REVISION",
	"MEDIA_CAPABILITY_EXPIRED",
]);
export const MediaSeatResultSchema = z.strictObject({
	type: z.literal("MEDIA_SEAT_RESULT"),
	requestId: SessionId,
	targetParticipantSessionId: SessionId,
	code: MediaSeatResultCodeSchema,
	snapshot: RoomMediaV3SnapshotSchema,
});
export type RoomMediaV3Capabilities = z.infer<
	typeof RoomMediaV3CapabilitiesSchema
>;
export type ParticipantMediaV3State = z.infer<
	typeof ParticipantMediaV3StateSchema
>;
export type RoomMediaV3CapabilityLease = z.infer<
	typeof RoomMediaV3CapabilityLeaseSchema
>;
export type RoomMediaV3Snapshot = z.infer<typeof RoomMediaV3SnapshotSchema>;
export type MediaV3IntentAck = z.infer<typeof MediaV3IntentAckSchema>;
export type MediaV3IntentError = z.infer<typeof MediaV3IntentErrorSchema>;
export type SetMediaSeat = z.infer<typeof SetMediaSeatSchema>;
export type MediaSeatResult = z.infer<typeof MediaSeatResultSchema>;
export type MediaSeatResultCode = z.infer<typeof MediaSeatResultCodeSchema>;
export type RoomMediaCapabilities = z.infer<typeof RoomMediaCapabilitiesSchema>;
export type ParticipantMediaState = z.infer<typeof ParticipantMediaStateSchema>;
export type RoomMediaCapabilityLease = z.infer<
	typeof RoomMediaCapabilityLeaseSchema
>;
export type RoomMediaSnapshot = z.infer<typeof RoomMediaSnapshotSchema>;
export type MediaIntentAck = z.infer<typeof MediaIntentAckSchema>;
export type MediaIntentError = z.infer<typeof MediaIntentErrorSchema>;
/** Apply seat-result and broadcast snapshots through the same fence. Authority
 * comes from the active room binding, never from a result's generation. A caller
 * updates that binding through the existing authenticated room lifecycle. */
export function shouldApplyRoomMediaSnapshot(
	expected: { roomId: string; roomGeneration: number },
	current: {
		roomId: string;
		roomGeneration: number;
		snapshotSequence: number;
	} | null,
	incoming: {
		roomId: string;
		roomGeneration: number;
		snapshotSequence: number;
	},
): boolean {
	return (
		incoming.roomId === expected.roomId &&
		incoming.roomGeneration === expected.roomGeneration &&
		(current === null ||
			current.roomId !== expected.roomId ||
			current.roomGeneration !== expected.roomGeneration ||
			incoming.snapshotSequence > current.snapshotSequence)
	);
}
