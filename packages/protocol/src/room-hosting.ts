import { z } from "zod";

const time = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

// Server-to-server only. This does not add a client WebSocket event or reason.
export const RoomHostingCutoverSchema = z
	.object({
		revision: positive,
		roomId: z.string().min(1).max(128),
		roomGeneration: positive,
		closingAt: time,
	})
	.strict();
export type RoomHostingCutover = z.infer<typeof RoomHostingCutoverSchema>;

export const RoomHostingCutoverReceiptSchema = z
	.object({
		cutover: RoomHostingCutoverSchema,
		fencedAt: time,
		finalizedAt: time.nullable(),
		webFinalized: z.boolean(),
	})
	.refine((v) =>
		v.finalizedAt === null
			? !v.webFinalized
			: v.webFinalized && v.finalizedAt >= v.fencedAt,
	);
export type RoomHostingCutoverReceipt = z.infer<
	typeof RoomHostingCutoverReceiptSchema
>;
export const RoomHostingAdmissionRequestSchema = z
	.object({ userId: z.string().uuid() })
	.strict();

export const RoomHostingAdmissionSchema = z
	.object({
		roomId: z.string().min(1).max(128),
		roomGeneration: positive,
		allowed: z.boolean(),
		code: z.enum(["ROOM_ENDED", "HOST_SUBSCRIPTION_REQUIRED"]).optional(),
		cutover: RoomHostingCutoverSchema.optional(),
	})
	.refine((v) =>
		v.allowed
			? v.code === undefined && v.cutover === undefined
			: v.code !== undefined,
	)
	.refine(
		(v) =>
			!v.cutover ||
			(v.cutover.roomId === v.roomId &&
				v.cutover.roomGeneration === v.roomGeneration),
	);
export type RoomHostingAdmission = z.infer<typeof RoomHostingAdmissionSchema>;
