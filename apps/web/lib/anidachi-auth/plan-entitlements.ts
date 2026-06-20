export type PlanCode = "watcher" | "nakama" | "junkie";
export type PaidPlanCode = Exclude<PlanCode, "watcher">;
export type LegacyCheckoutTier = "crunchyroll_subscriber" | "anime_junkie";

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

export const FREE_PLAN_CODE: PlanCode = "watcher";

export const PLAN_ENTITLEMENTS: Record<PlanCode, PlanEntitlements> = {
  watcher: {
    planCode: "watcher",
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
  nakama: {
    planCode: "nakama",
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
  junkie: {
    planCode: "junkie",
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
  watcher: 0,
  nakama: 1,
  junkie: 2,
};

export function isPlanCode(value: unknown): value is PlanCode {
  return value === "watcher" || value === "nakama" || value === "junkie";
}

export function isPaidPlanCode(value: unknown): value is PaidPlanCode {
  return value === "nakama" || value === "junkie";
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
  return PLAN_ENTITLEMENTS[isPlanCode(planCode) ? planCode : FREE_PLAN_CODE];
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

export function legacyTierToPlanCode(tier: unknown): PaidPlanCode | null {
  if (tier === "crunchyroll_subscriber") return "nakama";
  if (tier === "anime_junkie") return "junkie";
  return null;
}

export function checkoutInputToPaidPlanCode(input: {
  planCode?: unknown;
  tier?: unknown;
}): PaidPlanCode | null {
  if (isPaidPlanCode(input.planCode)) return input.planCode;
  return legacyTierToPlanCode(input.tier);
}
