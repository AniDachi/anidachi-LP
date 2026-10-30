import { z } from "zod";
import { MAX_ROOM_ID_CHARS } from "./limits";

// Independent of legacy PlanPolicy/HostingAccess/RoomQuota* versions. No runtime
// currently issues this contract; it is not a new room event or admission claim.
const SafeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Timestamp = SafeInteger.max(8_640_000_000_000_000);
const UtcDay = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine((day) => {
		const instant = Date.parse(`${day}T00:00:00.000Z`);
		return (
			Number.isFinite(instant) &&
			new Date(instant).toISOString().slice(0, 10) === day
		);
	}, "Invalid UTC calendar day");
const scope = {
	ownerUserId: z.uuid(),
	roomId: z.string().min(1).max(MAX_ROOM_ID_CHARS),
	roomGeneration: SafeInteger.positive(),
};

/** Context supplied by the active authenticated room lifecycle, never copied
 * from an incoming snapshot. utcDay uses trusted server time, not device zone.
 * Clear this binding when the room ends; a snapshot cannot revive a generation.
 */
export const HostingTimeBindingSchema = z.strictObject({
	...scope,
	utcDay: UtcDay,
});
export type HostingTimeBinding = z.infer<typeof HostingTimeBindingSchema>;

/** Account-wide UTC budget, shared across the host's rooms/devices/providers.
 * usedSeconds is consumed budget capped at 1200, including authoritative live
 * usage as of outer serverTime, not a raw durable settlement total (which can
 * include liveness overshoot). Do not add room usage again or carry time over.
 * metering means host + at least one guest are present, including playback pause;
 * a solo host does not meter. Durable intervals/ACKs remain server internals.
 */
const DailyFree = z
	.strictObject({
		kind: z.literal("daily_free"),
		budgetSeconds: z.literal(1200),
		usedSeconds: z.number().int().min(0).max(1200),
		remainingSeconds: z.number().int().min(0).max(1200),
		metering: z.boolean(),
	})
	.refine(
		(access) => access.usedSeconds + access.remainingSeconds === 1200,
		"Used and remaining seconds must equal the daily budget",
	);

/** A server-confirmed time right only: never upgrades the room's pinned
 * hostPlanCode, participant/camera/media-seat caps, or personal history rights.
 * validUntil bounds this time-right assertion, not existing renewal/reconnect
 * grace. Null is explicit indefinite manual authority only, never missing data.
 */
const ConfirmedUnlimited = z
	.strictObject({
		kind: z.literal("confirmed_unlimited"),
		source: z.enum(["paid", "trial", "manual"]),
		validUntil: Timestamp.nullable(),
	})
	.refine(
		(access) => access.source === "manual" || access.validUntil !== null,
		"Paid and trial time rights require an expiry",
	);

export const HostingTimeAccessSchema = z.discriminatedUnion("kind", [
	DailyFree,
	ConfirmedUnlimited,
	z.strictObject({ kind: z.literal("unknown") }),
]);
export type HostingTimeAccess = z.infer<typeof HostingTimeAccessSchema>;

/** Display/compatibility contract, not authentication or permission to admit,
 * continue, or terminate a room. Only an authenticated server can issue rights.
 * Sequence is strictly increasing throughout one owner/room/generation, across
 * days and time-right changes; serverTime is the authoritative measurement in ms.
 * The period describes the account's UTC day even for unlimited/unknown access.
 * resetAt is exactly next UTC midnight: a new-period boundary, not a room-end
 * deadline. Reaching it locally never grants a new budget; await a fresh server
 * snapshot. Future runtime owns settlement, rollover and next-event scheduling.
 */
export const HostingTimeSnapshotSchema = z
	.strictObject({
		hostingTimeVersion: z.literal(1),
		...scope,
		snapshotSequence: SafeInteger,
		serverTime: Timestamp,
		period: z.strictObject({ utcDay: UtcDay, resetAt: Timestamp }),
		access: HostingTimeAccessSchema,
	})
	.superRefine((snapshot, ctx) => {
		const start = Date.parse(`${snapshot.period.utcDay}T00:00:00.000Z`);
		const end = start + 86_400_000;
		if (
			snapshot.serverTime < start ||
			snapshot.serverTime >= end ||
			snapshot.period.resetAt !== end
		) {
			ctx.addIssue({
				code: "custom",
				path: ["period"],
				message:
					"Period must contain serverTime and reset at the next UTC midnight",
			});
		}
		const access = snapshot.access;
		if (
			access.kind === "confirmed_unlimited" &&
			access.validUntil !== null &&
			access.validUntil <= snapshot.serverTime
		) {
			ctx.addIssue({
				code: "custom",
				path: ["access", "validUntil"],
				message: "Time right must be unexpired at serverTime",
			});
		}
	});
export type HostingTimeSnapshot = z.infer<typeof HostingTimeSnapshotSchema>;
