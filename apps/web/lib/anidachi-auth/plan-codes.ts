export type CanonicalPlanCode = "free" | "plus" | "pro";
export type PlanCode = CanonicalPlanCode;
export type PaidPlanCode = Exclude<PlanCode, "free">;
export type LegacyPlanCode = "watcher" | "nakama" | "junkie";
export type AcceptedPlanCode = PlanCode | LegacyPlanCode;
export type LegacyCheckoutTier = "crunchyroll_subscriber" | "anime_junkie";

export const FREE_PLAN_CODE: PlanCode = "free";
export const PAID_PLAN_CODES = ["plus", "pro"] as const satisfies readonly PaidPlanCode[];

const LEGACY_PLAN_TO_CANONICAL: Record<LegacyPlanCode, PlanCode> = {
  watcher: "free",
  nakama: "plus",
  junkie: "pro",
};

const LEGACY_TIER_TO_CANONICAL: Record<LegacyCheckoutTier, PaidPlanCode> = {
  crunchyroll_subscriber: "plus",
  anime_junkie: "pro",
};

export function isCanonicalPlanCode(value: unknown): value is PlanCode {
  return value === "free" || value === "plus" || value === "pro";
}

export function isLegacyPlanCode(value: unknown): value is LegacyPlanCode {
  return value === "watcher" || value === "nakama" || value === "junkie";
}

export function isAcceptedPlanCode(value: unknown): value is AcceptedPlanCode {
  return isCanonicalPlanCode(value) || isLegacyPlanCode(value);
}

export function isPaidPlanCode(value: unknown): value is PaidPlanCode {
  return value === "plus" || value === "pro";
}

export function normalizePlanCode(value: unknown): PlanCode {
  if (isCanonicalPlanCode(value)) return value;
  if (isLegacyPlanCode(value)) return LEGACY_PLAN_TO_CANONICAL[value];
  return FREE_PLAN_CODE;
}

export function normalizePaidPlanCode(value: unknown): PaidPlanCode | null {
  const planCode = normalizePlanCode(value);
  return isPaidPlanCode(planCode) ? planCode : null;
}

export function legacyTierToPlanCode(tier: unknown): PaidPlanCode | null {
  if (tier === "crunchyroll_subscriber") return LEGACY_TIER_TO_CANONICAL[tier];
  if (tier === "anime_junkie") return LEGACY_TIER_TO_CANONICAL[tier];
  return null;
}

export function checkoutInputToPaidPlanCode(input: {
  planCode?: unknown;
  tier?: unknown;
}): PaidPlanCode | null {
  return normalizePaidPlanCode(input.planCode) ?? legacyTierToPlanCode(input.tier);
}
