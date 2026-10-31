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

/** Internal SQL read DTO, not a browser response or admission capability.
 * The Web producer validates current owner/time/grant consistency before using
 * it to construct AccountHostingStatus. Keep all Free20 wire shapes here.
 */
const AuthorityDate = z.iso.datetime({ offset: true }).transform(Date.parse);
const AuthorityCounter = z
	.number()
	.int()
	.nonnegative()
	.max(Number.MAX_SAFE_INTEGER);
export const Free20AccountAuthoritySchema = z.strictObject({
	enabled: z.literal(true),
	ownerUserId: HostingTimeBindingSchema.shape.ownerUserId,
	planCode: PlanCodeSchema,
	serverTime: AuthorityDate,
	refreshBy: AuthorityDate,
	resetAt: AuthorityDate,
	accountGeneration: AuthorityCounter.positive(),
	accessEpoch: AuthorityCounter.positive(),
	committedSeconds: AuthorityCounter,
	grant: z
		.strictObject({
			source: z.enum(["paid", "trial", "manual"]),
			validUntil: AuthorityDate.nullable(),
		})
		.nullable(),
	assignment: z
		.strictObject({
			roomId: HostingTimeBindingSchema.shape.roomId,
			roomGeneration: z.literal(1),
			role: z.enum(["host", "member"]),
			sessionId: z.string().min(1).max(128),
			hostingTimeMode: z.literal("daily_free20").nullable(),
			status: z.enum(["lobby", "live", "ended"]),
			hostUserId: HostingTimeBindingSchema.shape.ownerUserId,
		})
		.nullable(),
});
export type Free20AccountAuthority = z.infer<
	typeof Free20AccountAuthoritySchema
>;
