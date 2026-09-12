import { z } from "zod";
import { getPlanPolicy, PlanCodeSchema } from "./commercial-policy";
import { MAX_ROOM_ID_CHARS, MAX_SESSION_ID_CHARS } from "./limits";

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
export const ParticipantMediaStateSchema = z.strictObject({
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
export const RoomMediaCapabilitiesSchema = z
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
export const RoomMediaCapabilityLeaseSchema = z
	.strictObject({
		...scope,
		issuedAt: Timestamp,
		paidUntil: Timestamp.nullable(),
		capabilities: RoomMediaCapabilitiesSchema,
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
	state: ParticipantMediaStateSchema,
};
/** Ack state includes the last accepted sequence. Duplicate/stale requests return
 * current state; consumers must fence by room/session and snapshotSequence.
 */
export const MediaIntentAckSchema = z
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
export const MediaIntentErrorSchema = z.strictObject({
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
export const RoomMediaSnapshotSchema = z
	.strictObject({
		type: z.literal("ROOM_MEDIA_SNAPSHOT"),
		...scope,
		snapshotSequence: Sequence,
		capabilities: RoomMediaCapabilitiesSchema,
		participants: z
			.array(
				ParticipantMediaStateSchema.extend({ participantSessionId: SessionId }),
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
export type ParticipantMediaState = z.infer<typeof ParticipantMediaStateSchema>;
export type RoomMediaCapabilities = z.infer<typeof RoomMediaCapabilitiesSchema>;
export type RoomMediaCapabilityLease = z.infer<
	typeof RoomMediaCapabilityLeaseSchema
>;
export type MediaIntentAck = z.infer<typeof MediaIntentAckSchema>;
export type MediaIntentError = z.infer<typeof MediaIntentErrorSchema>;
export type RoomMediaSnapshot = z.infer<typeof RoomMediaSnapshotSchema>;
/** Inputs must be actual current members, selected by authenticated Worker state.
 * Grant enables publication, never requires receivers to call getUserMedia.
 */
export function isRoomMediaPairAllowed(
	a: Pick<ParticipantMediaState, "cameraGranted" | "microphoneGranted"> & {
		roomId: string;
		roomGeneration: number;
		participantSessionId: string;
	},
	b: Pick<ParticipantMediaState, "cameraGranted" | "microphoneGranted"> & {
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
