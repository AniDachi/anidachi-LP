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
    maxActiveTrackedTitles: number;
    historyRetentionDays: number;
  };
};

export type RoomCapabilities = {
  hostPlanCode: PlanCode;
  maxParticipants: number;
  maxMediaSeats: number;
  canNameRoom: boolean;
  canSendPushInvites: boolean;
};

export const PLAN_ENTITLEMENTS: Record<PlanCode, PlanEntitlements> = {
  free: {
    planCode: "free",
    label: "Free",
    room: {
      dailyHostSeconds: 30 * 60,
      maxParticipants: 4,
      maxMediaSeats: 0,
      canNameRoom: false,
      canSendPushInvites: false,
    },
    account: {
      maxOwnedGroups: 1,
      maxActiveTrackedTitles: 3,
      historyRetentionDays: 7,
    },
  },
  plus: {
    planCode: "plus",
    label: "Plus",
    room: {
      dailyHostSeconds: "unlimited",
      maxParticipants: 6,
      maxMediaSeats: 4,
      canNameRoom: true,
      canSendPushInvites: true,
    },
    account: {
      maxOwnedGroups: 5,
      maxActiveTrackedTitles: 15,
      historyRetentionDays: 92,
    },
  },
  pro: {
    planCode: "pro",
    label: "Pro",
    room: {
      dailyHostSeconds: "unlimited",
      maxParticipants: 15,
      maxMediaSeats: 4,
      canNameRoom: true,
      canSendPushInvites: true,
    },
    account: {
      maxOwnedGroups: 15,
      maxActiveTrackedTitles: 50,
      historyRetentionDays: 366,
    },
  },
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
  return PLAN_ENTITLEMENTS[normalizePlanCode(planCode)];
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
