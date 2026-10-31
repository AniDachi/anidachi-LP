import { z } from "zod";
import { PlanCodeSchema } from "./commercial-policy";
import {
	ConfirmedUnlimitedHostingTimeSchema,
	DailyFreeHostingTimeSchema,
	HostingTimeBindingSchema,
} from "./hosting-time";

const Timestamp = z.number().int().nonnegative().max(8_640_000_000_000_000);
const Period = z.strictObject({
	utcDay: HostingTimeBindingSchema.shape.utcDay,
	resetAt: Timestamp,
});
const CurrentRoom = z.strictObject({
	roomId: HostingTimeBindingSchema.shape.roomId,
	role: z.enum(["host", "member"]),
});
function validReadWindow(day: string, at: number, until: number) {
	const start = Date.parse(`${day}T00:00:00.000Z`);
	return (
		at >= start &&
		at < start + 86_400_000 &&
		until > at &&
		until <= Math.min(start + 86_400_000, at + 300_000)
	);
}

/** Independent account display contract. Never substitute this for legacy
 * HostingAccess/RoomQuotaStatus, a room token, or the live room event contract.
 * canCreateRoom is a bounded observation; admission always checks again.
 * Unknown authority is a 503 response, never a successful zero/null allowance.
 */
export const AccountHostingStatusSchema = z
	.strictObject({
		accountHostingVersion: z.literal(1),
		ownerUserId: HostingTimeBindingSchema.shape.ownerUserId,
		planCode: PlanCodeSchema,
		serverTime: Timestamp,
		validUntil: Timestamp,
		period: Period,
		access: z.discriminatedUnion("kind", [
			DailyFreeHostingTimeSchema,
			ConfirmedUnlimitedHostingTimeSchema,
		]),
		activeRoom: CurrentRoom.nullable(),
		canCreateRoom: z.boolean(),
	})
	.superRefine((value, ctx) => {
		const access = value.access;
		if (
			!validReadWindow(
				value.period.utcDay,
				value.serverTime,
				value.validUntil,
			) ||
			value.period.resetAt !==
				Date.parse(`${value.period.utcDay}T00:00:00.000Z`) + 86_400_000 ||
			(value.planCode === "free") !== (access.kind === "daily_free") ||
			value.canCreateRoom !==
				(value.activeRoom === null &&
					(access.kind === "confirmed_unlimited" ||
						access.remainingSeconds > 0)) ||
			(access.kind === "daily_free" &&
				access.metering &&
				value.activeRoom?.role !== "host") ||
			(access.kind === "confirmed_unlimited" &&
				access.validUntil !== null &&
				value.validUntil > access.validUntil)
		) {
			ctx.addIssue({
				code: "custom",
				message: "Inconsistent account hosting status",
			});
		}
	});
export type AccountHostingStatus = z.infer<typeof AccountHostingStatusSchema>;
export const ACCOUNT_HOSTING_OWNER_HEADER = "x-anidachi-hosting-owner";

export function acceptAccountHostingStatus(
	ownerUserId: string,
	value: unknown,
): AccountHostingStatus | null {
	const parsed = AccountHostingStatusSchema.safeParse(value);
	return parsed.success && parsed.data.ownerUserId === ownerUserId
		? parsed.data
		: null;
}

/** Server-to-server read only. No request chooses or reserves an allowance. */
export const Free20LiveStatusRequestSchema = z.strictObject({
	ownerUserId: HostingTimeBindingSchema.shape.ownerUserId,
	roomId: HostingTimeBindingSchema.shape.roomId,
	roomGeneration: HostingTimeBindingSchema.shape.roomGeneration,
});
export type Free20LiveStatusRequest = z.infer<
	typeof Free20LiveStatusRequestSchema
>;
export const Free20LiveStatusSchema = Free20LiveStatusRequestSchema.extend({
	liveStatusVersion: z.literal(1),
	utcDay: HostingTimeBindingSchema.shape.utcDay,
	serverTime: Timestamp,
	validUntil: Timestamp,
	access: DailyFreeHostingTimeSchema,
}).refine(
	(value) => validReadWindow(value.utcDay, value.serverTime, value.validUntil),
	"Invalid live read window",
);
export type Free20LiveStatus = z.infer<typeof Free20LiveStatusSchema>;
