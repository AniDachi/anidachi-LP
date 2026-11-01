import { z } from "zod";
import { HostingTimeBindingSchema } from "./hosting-time";

/** Authenticated server command: asks the room to revalidate existing authority.
 * No entitlement, allowance or client clock can be supplied by this request.
 */
export const Free20RoomRefreshRequestSchema = z.strictObject({
 refreshVersion: z.literal(1),
 ownerUserId: HostingTimeBindingSchema.shape.ownerUserId,
 roomId: HostingTimeBindingSchema.shape.roomId,
 roomGeneration: HostingTimeBindingSchema.shape.roomGeneration,
 revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
export type Free20RoomRefreshRequest = z.infer<typeof Free20RoomRefreshRequestSchema>;

/** Processing ACK only, never proof of access or an unlimited time right.
 * Applied includes requests already satisfied by a completed newer revision.
 */
export const Free20RoomRefreshReceiptSchema = z.strictObject({
 request: Free20RoomRefreshRequestSchema,
 outcome: z.enum(["applied", "terminal", "stale"]),
});
export type Free20RoomRefreshReceipt = z.infer<typeof Free20RoomRefreshReceiptSchema>;
