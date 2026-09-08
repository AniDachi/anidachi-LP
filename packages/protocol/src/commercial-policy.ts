import { z } from "zod";

export const PlanCodeSchema = z.enum(["free", "plus", "pro"]);
export type PlanCode = z.infer<typeof PlanCodeSchema>;
export const PlanPolicySchema = z.discriminatedUnion("planCode", [
	z.strictObject({
		planCode: z.literal("free"),
		historyEnabled: z.literal(false),
		dailyHostSeconds: z.literal(1800),
		maxParticipants: z.literal(4),
		maxCameras: z.literal(4),
		maxMicrophones: z.literal(4),
	}),
	z.strictObject({
		planCode: z.literal("plus"),
		historyEnabled: z.literal(true),
		dailyHostSeconds: z.null(),
		maxParticipants: z.literal(6),
		maxCameras: z.literal(4),
		maxMicrophones: z.literal(6),
	}),
	z.strictObject({
		planCode: z.literal("pro"),
		historyEnabled: z.literal(true),
		dailyHostSeconds: z.null(),
		maxParticipants: z.literal(15),
		maxCameras: z.literal(4),
		maxMicrophones: z.literal(8),
	}),
]);
export type PlanPolicy = z.infer<typeof PlanPolicySchema>;
const policies = {
	free: {
		planCode: "free",
		historyEnabled: false,
		dailyHostSeconds: 1800,
		maxParticipants: 4,
		maxCameras: 4,
		maxMicrophones: 4,
	},
	plus: {
		planCode: "plus",
		historyEnabled: true,
		dailyHostSeconds: null,
		maxParticipants: 6,
		maxCameras: 4,
		maxMicrophones: 6,
	},
	pro: {
		planCode: "pro",
		historyEnabled: true,
		dailyHostSeconds: null,
		maxParticipants: 15,
		maxCameras: 4,
		maxMicrophones: 8,
	},
} as const satisfies Record<PlanCode, PlanPolicy>;
/** Display/policy data, never proof of a user's entitlement. Return an isolated value. */
export function getPlanPolicy(planCode: PlanCode): PlanPolicy {
	return { ...policies[planCode] };
}

export const WATCH_HISTORY_ACCESS_LEASE_MS = 5 * 60 * 1000;
const Timestamp = z.iso.datetime({ offset: true });
const Epoch = z.number().int().nonnegative();
export const AccountEntitlementsMetadataSchema = z.strictObject({
	entitlementsVersion: z.literal(1),
	ownerUserId: z.uuid(),
	serverTime: Timestamp,
});
export type AccountEntitlementsMetadata = z.infer<
	typeof AccountEntitlementsMetadataSchema
>;
export const WatchHistoryAccessSchema = z
	.strictObject({
		accessVersion: z.literal(1),
		ownerUserId: z.uuid(),
		accountGeneration: z.number().int().positive(),
		accessEpoch: Epoch,
		youtubeConsentEpoch: Epoch,
		state: z.enum(["allowed", "plan_required"]),
		serverTime: Timestamp,
		captureNotBefore: Timestamp,
		validUntil: Timestamp,
		// A saved preference can remain true on Free; state still denies capture.
		youtubeHistoryEnabled: z.boolean(),
	})
	.superRefine((access, ctx) => {
		const issued = Date.parse(access.serverTime);
		const expires = Date.parse(access.validUntil);
		if (expires <= issued || expires > issued + WATCH_HISTORY_ACCESS_LEASE_MS)
			ctx.addIssue({
				code: "custom",
				path: ["validUntil"],
				message: "Access lease must last at most five minutes",
			});
		if (Date.parse(access.captureNotBefore) > issued)
			ctx.addIssue({
				code: "custom",
				path: ["captureNotBefore"],
				message: "Capture boundary cannot follow server time",
			});
	});
export type WatchHistoryAccess = z.infer<typeof WatchHistoryAccessSchema>;
/** Context must come from the active authenticated owner and server-adjusted clock.
 * Server issuance must additionally clamp validUntil to the durable paid expiry.
 * This local gate never substitutes for transaction-time server authorization.
 */
export function isWatchHistoryAccessCurrent(
	access: WatchHistoryAccess,
	context: {
		ownerUserId: string;
		accountGeneration: number;
		accessEpoch: number;
		youtubeConsentEpoch: number;
		now: number;
		provider: "crunchyroll" | "youtube";
	},
): boolean {
	return (
		access.state === "allowed" &&
		access.ownerUserId === context.ownerUserId &&
		access.accountGeneration === context.accountGeneration &&
		access.accessEpoch === context.accessEpoch &&
		access.youtubeConsentEpoch === context.youtubeConsentEpoch &&
		Number.isFinite(context.now) &&
		context.now >= Date.parse(access.serverTime) &&
		context.now < Date.parse(access.validUntil) &&
		(context.provider !== "youtube" || access.youtubeHistoryEnabled)
	);
}
