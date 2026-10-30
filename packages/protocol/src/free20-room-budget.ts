import { z } from "zod";
import { HostingTimeBindingSchema } from "./hosting-time";
import { RoomUsageSummarySchema } from "./types";

const Counter = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Timestamp = Counter.max(8_640_000_000_000_000);
const Usage = RoomUsageSummarySchema.extend({
	day: HostingTimeBindingSchema.shape.utcDay,
})
	.array()
	.max(2)
	.refine(
		(buckets) =>
			new Set(buckets.map((bucket) => bucket.day)).size === buckets.length,
		"Usage days must be unique",
	);

/** Inactive internal server contract. A single authoritative DO must serialize
 * requests, persist its materialized meter BEFORE I/O, and keep a monotonically
 * increasing sequence across retries/restarts/days. This is not room admission.
 */
export const Free20RoomBudgetRequestSchema = z.strictObject({
	roomId: HostingTimeBindingSchema.shape.roomId,
	roomGeneration: HostingTimeBindingSchema.shape.roomGeneration,
	checkpointSequence: Counter,
	usage: Usage,
});
export type Free20RoomBudgetRequest = z.infer<
	typeof Free20RoomBudgetRequestSchema
>;

/** ACKs and the account total are ONE post-commit response, never independent
 * reads that a consumer may mix. committedSeconds includes this room's ACKed
 * seconds and may exceed 1200. This is neither the public HostingTimeSnapshot
 * nor a lease, reservation, unlimited assertion, or permission to revive a room.
 * No existing HTTP/WS route issues this prepared contract.
 */
export const Free20RoomBudgetCheckpointSchema = HostingTimeBindingSchema.extend(
	{
		roomBudgetVersion: z.literal(1),
		checkpointSequence: Counter,
		serverTime: Timestamp,
		resetAt: Timestamp,
		refreshBy: Timestamp,
		budgetSeconds: z.literal(1200),
		committedSeconds: Counter,
		acknowledged: Usage,
	},
).superRefine((value, ctx) => {
	const start = Date.parse(`${value.utcDay}T00:00:00.000Z`);
	const end = start + 86_400_000;
	if (
		value.serverTime < start ||
		value.serverTime >= end ||
		value.resetAt !== end ||
		value.refreshBy <= value.serverTime ||
		value.refreshBy > end
	) {
		ctx.addIssue({
			code: "custom",
			message: "Invalid Free20 authority period",
		});
	}
	if (value.acknowledged.some((ack) => ack.day > value.utcDay)) {
		ctx.addIssue({
			code: "custom",
			message: "Future usage cannot be acknowledged",
		});
	}
});
export type Free20RoomBudgetCheckpoint = z.infer<
	typeof Free20RoomBudgetCheckpointSchema
>;
