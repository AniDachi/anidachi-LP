import { z } from "zod";

export const ROOM_PRESENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const RoomPresenceParticipantSchema = z
	.object({
		userId: z.string().uuid(),
		sessionId: z.string().min(1).max(128),
	})
	.strict();
export const RoomPresenceEvidenceSchema = z
	.object({
		roomId: z.string().min(1).max(128),
		roomGeneration: z.number().int().positive().safe(),
		participants: z.tuple([
			RoomPresenceParticipantSchema,
			RoomPresenceParticipantSchema,
		]),
		observedAt: z.number().int().nonnegative().safe(),
	})
	.strict()
	.refine(
		(value) => value.participants[0].userId < value.participants[1].userId,
		"Presence participants must be distinct and ordered",
	);
export type RoomPresenceEvidence = z.infer<typeof RoomPresenceEvidenceSchema>;
export const RoomPresenceAcknowledgementSchema = z
	.object({ accepted: z.literal(true) })
	.strict();
