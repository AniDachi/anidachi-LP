import { getPlanPolicy } from "@anidachi/protocol";
import {
	FREE_PLAN_CODE,
	checkoutInputToPaidPlanCode,
	isCanonicalPlanCode,
	isPaidPlanCode,
	legacyTierToPlanCode,
	normalizePaidPlanCode,
	normalizePlanCode,
	type LegacyCheckoutTier,
	type PaidPlanCode,
	type PlanCode,
} from "./plan-codes";

export {
	FREE_PLAN_CODE,
	checkoutInputToPaidPlanCode,
	isPaidPlanCode,
	legacyTierToPlanCode,
	normalizePaidPlanCode,
	normalizePlanCode,
};
export type { LegacyCheckoutTier, PaidPlanCode, PlanCode };

export type PlanEntitlements = {
	planCode: PlanCode;
	label: "Free" | "Plus" | "Pro";
	room: {
		dailyHostSeconds: number | "unlimited";
		maxParticipants: number;
		maxMediaSeats: number;
		canNameRoom: boolean;
		canSendPushInvites: boolean;
	};
	account: {
		maxOwnedGroups: number;
		historyEnabled: boolean;
	};
};

export type RoomCapabilities = {
	hostPlanCode: PlanCode;
	maxParticipants: number;
	maxMediaSeats: number;
	canNameRoom: boolean;
	canSendPushInvites: boolean;
};

function planEntitlements(
	planCode: PlanCode,
	label: PlanEntitlements["label"],
	maxOwnedGroups: number,
): PlanEntitlements {
	const policy = getPlanPolicy(planCode);
	return {
		planCode,
		label,
		room: {
			dailyHostSeconds: policy.dailyHostSeconds ?? "unlimited",
			maxParticipants: policy.maxParticipants,
			// Legacy production transport until coordinated v2 media consumer cutover.
			maxMediaSeats: 4,
			canNameRoom: planCode !== "free",
			canSendPushInvites: planCode !== "free",
		},
		account: { maxOwnedGroups, historyEnabled: policy.historyEnabled },
	};
}
export const PLAN_ENTITLEMENTS: Record<PlanCode, PlanEntitlements> = {
	free: planEntitlements("free", "Free", 1),
	plus: planEntitlements("plus", "Plus", 5),
	pro: planEntitlements("pro", "Pro", 15),
};

const PLAN_RANK: Record<PlanCode, number> = {
	free: 0,
	plus: 1,
	pro: 2,
};

export function isPlanCode(value: unknown): value is PlanCode {
	return isCanonicalPlanCode(value);
}

export function planRank(planCode: PlanCode): number {
	return PLAN_RANK[planCode];
}

export function maxPlanCode(plans: Iterable<PlanCode>): PlanCode {
	let best: PlanCode = FREE_PLAN_CODE;
	for (const plan of plans) {
		if (planRank(plan) > planRank(best)) best = plan;
	}
	return best;
}

export function getPlanEntitlements(planCode: unknown): PlanEntitlements {
	const value = PLAN_ENTITLEMENTS[normalizePlanCode(planCode)];
	return { ...value, room: { ...value.room }, account: { ...value.account } };
}

export function roomCapabilitiesForPlan(planCode: unknown): RoomCapabilities {
	const entitlements = getPlanEntitlements(planCode);
	return {
		hostPlanCode: entitlements.planCode,
		maxParticipants: entitlements.room.maxParticipants,
		maxMediaSeats: entitlements.room.maxMediaSeats,
		canNameRoom: entitlements.room.canNameRoom,
		canSendPushInvites: entitlements.room.canSendPushInvites,
	};
}

export function isRoomCapabilities(value: unknown): value is RoomCapabilities {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const capabilities = value as Record<string, unknown>;
	return (
		isPlanCode(capabilities.hostPlanCode) &&
		typeof capabilities.maxParticipants === "number" &&
		Number.isInteger(capabilities.maxParticipants) &&
		capabilities.maxParticipants >= 1 &&
		capabilities.maxParticipants <= 50 &&
		typeof capabilities.maxMediaSeats === "number" &&
		Number.isInteger(capabilities.maxMediaSeats) &&
		capabilities.maxMediaSeats >= 0 &&
		capabilities.maxMediaSeats <= 16 &&
		typeof capabilities.canNameRoom === "boolean" &&
		typeof capabilities.canSendPushInvites === "boolean"
	);
}

/** Inert v1 library compatibility only; never serialize these retired quotas as entitlements. */
export function getLegacyWatchLibraryEntitlements(planCode: unknown) {
	const current = getPlanEntitlements(planCode);
	const retired = { free: [3, 7], plus: [15, 92], pro: [50, 366] } as const;
	const [maxActiveTrackedTitles, historyRetentionDays] =
		retired[current.planCode];
	return {
		...current,
		account: {
			...current.account,
			maxActiveTrackedTitles,
			historyRetentionDays,
		},
	};
}
