import { z } from "zod";
import { HostingTimeBindingSchema } from "./hosting-time";

const Timestamp = z.number().int().nonnegative().max(8_640_000_000_000_000);
const Counter = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const binding = HostingTimeBindingSchema.shape;
export const FREE20_WARNING_THRESHOLD_SECONDS = 300;
export const FREE20_WARNING_MAX_AGE_MS = 10_000;
export const FREE20_WARNING_MAX_BODY_BYTES = 1024;

/** Browser supplies stale-context fences only, never eligibility or seconds. */
export const Free20WarningRequestSchema = z.strictObject({
	hostingWarningVersion: z.literal(1),
	roomId: binding.roomId,
	roomGeneration: binding.roomGeneration,
	utcDay: binding.utcDay,
});
export type Free20WarningRequest = z.infer<typeof Free20WarningRequestSchema>;
const response = {
	...Free20WarningRequestSchema.shape,
	ownerUserId: binding.ownerUserId,
	serverTime: Timestamp,
	validUntil: Timestamp,
};
/** At most one display authorization per account/day. A lost response may omit
 * the notice. This is never an allowance, room lease or exactly-once delivery. */
export const Free20WarningResponseSchema = z
	.discriminatedUnion("decision", [
		z.strictObject({
			...response,
			decision: z.literal("show"),
			thresholdSeconds: z.literal(300),
			claimId: z.uuid(),
		}),
		z.strictObject({ ...response, decision: z.literal("already_claimed") }),
		z.strictObject({ ...response, decision: z.literal("not_eligible") }),
	])
	.refine((value) => {
		const start = Date.parse(`${value.utcDay}T00:00:00.000Z`);
		return (
			value.serverTime >= start &&
			value.serverTime < start + 86400000 &&
			value.validUntil > value.serverTime &&
			value.validUntil <=
				Math.min(start + 86400000, value.serverTime + FREE20_WARNING_MAX_AGE_MS)
		);
	}, "Invalid warning authorization window");
export type Free20WarningResponse = z.infer<typeof Free20WarningResponseSchema>;

/** Service-only preflight fences. Dates are normalized integer epoch-ms, NOT
 * the raw SQL authority ISO DTO. Committed seconds are deliberately absent:
 * settlement may move the storage split without changing the DO live total. */
export const Free20WarningContextSchema = z
	.strictObject({
		ownerUserId: binding.ownerUserId,
		accountGeneration: Counter.positive(),
		accessEpoch: Counter,
		planCode: z.literal("free"),
		grant: z.null(),
		utcDay: binding.utcDay,
		serverTime: Timestamp,
		refreshBy: Timestamp,
		resetAt: Timestamp,
		assignment: z.strictObject({
			roomId: binding.roomId,
			roomGeneration: z.literal(1),
			role: z.literal("host"),
			sessionId: z.string().min(1).max(128),
			hostingTimeMode: z.literal("daily_free20"),
			status: z.enum(["lobby", "live"]),
			hostUserId: binding.ownerUserId,
		}),
	})
	.refine((value) => {
		const start = Date.parse(`${value.utcDay}T00:00:00.000Z`);
		return (
			value.serverTime >= start &&
			value.serverTime < start + 86400000 &&
			value.resetAt === start + 86400000 &&
			value.refreshBy > value.serverTime &&
			value.refreshBy <= Math.min(value.resetAt, value.serverTime + 300000) &&
			value.assignment.hostUserId === value.ownerUserId
		);
	}, "Inconsistent warning preflight");
export type Free20WarningContext = z.infer<typeof Free20WarningContextSchema>;
