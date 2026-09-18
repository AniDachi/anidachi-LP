import { getPlanPolicy } from "@anidachi/protocol";
import type { CompareTableRow } from "@/components/responsive-compare-table";

export type CheckoutTier = "plus" | "pro";

export const PRICING_PLUS_MONTHLY = 7.99;
export const PRICING_PRO_MONTHLY = 14.99;

export const PRICING_PLUS_LABEL = `$${PRICING_PLUS_MONTHLY.toFixed(2)}`;
export const PRICING_PRO_LABEL = `$${PRICING_PRO_MONTHLY.toFixed(2)}`;
export const PRICING_STARTING_AT = `$${PRICING_PLUS_MONTHLY.toFixed(2)}/month`;

export function pricingCheckoutCtaLabel(tier: CheckoutTier): string {
  return tier === "pro" ? "Start Pro" : "Start Plus";
}

export const PRICING_PLUS_SHORT = "$7.99/mo";
export const PRICING_PRO_SHORT = "$14.99/mo";

export type PricingTierId = "free" | CheckoutTier;

export type PricingTierMarketing = {
  id: PricingTierId;
  label: string;
  priceDisplay: string;
  priceSuffix?: string;
  audience: string;
  summary: string;
  features: string[];
};

const freePolicy = getPlanPolicy("free");
const plusPolicy = getPlanPolicy("plus");
const proPolicy = getPlanPolicy("pro");

const freeHostMins = freePolicy.dailyHostSeconds! / 60;

/**
 * Canonical Free / Plus / Pro marketing matrix (matches product policy).
 * Use this for cards, the pricing comparison table, and sitewide pricing cells.
 */
export const PRICING_PLAN_MATRIX_COLUMNS = [
  { id: "free", label: "Free" },
  { id: "plus", label: "Plus", highlight: true },
  { id: "pro", label: "Pro" },
] as const;

export const PRICING_PLAN_MATRIX_ROWS: CompareTableRow[] = [
  {
    feature: "Price",
    values: {
      free: "Free",
      plus: `${PRICING_PLUS_LABEL}/month`,
      pro: `${PRICING_PRO_LABEL}/month`,
    },
  },
  {
    feature: "Platforms",
    values: {
      free: "Crunchyroll + YouTube",
      plus: "Crunchyroll + YouTube",
      pro: "Crunchyroll + YouTube",
    },
  },
  {
    feature: "Host your own room",
    values: {
      free: `${freeHostMins} min/day`,
      plus: "No daily limit",
      pro: "No daily limit",
    },
  },
  {
    feature: "People in room (incl. host)",
    values: {
      free: `Up to ${freePolicy.maxParticipants}`,
      plus: `Up to ${plusPolicy.maxParticipants}`,
      pro: `Up to ${proPolicy.maxParticipants}`,
    },
  },
  {
    feature: "Cameras at once",
    values: {
      free: `Up to ${freePolicy.maxCameras}`,
      plus: `Up to ${plusPolicy.maxCameras}`,
      pro: `Up to ${proPolicy.maxCameras}`,
    },
  },
  {
    feature: "Mics at once",
    values: {
      free: `Up to ${freePolicy.maxMicrophones}`,
      plus: `Up to ${plusPolicy.maxMicrophones}`,
      pro: `Up to ${proPolicy.maxMicrophones}`,
    },
  },
  {
    feature: "Record & edit progress",
    values: {
      free: "no",
      plus: "Yes — both platforms",
      pro: "Yes — both platforms",
    },
  },
  {
    feature: "View saved history & resume",
    values: {
      free: "yes",
      plus: "yes",
      pro: "yes",
    },
  },
  {
    feature: "Join friends' rooms",
    values: {
      free: "yes",
      plus: "yes",
      pro: "yes",
    },
  },
  {
    feature: "Sync, chat & reactions",
    values: {
      free: "yes",
      plus: "yes",
      pro: "yes",
    },
  },
  {
    feature: "Friends, groups & invites",
    values: {
      free: "yes",
      plus: "yes",
      pro: "yes",
    },
  },
  {
    feature: "Priority support",
    values: {
      free: "no",
      plus: "no",
      pro: "yes",
    },
  },
  {
    feature: "Custom pricing (8+ groups)",
    values: {
      free: "no",
      plus: "no",
      pro: "Negotiable",
    },
  },
];

export const PRICING_TIERS: PricingTierMarketing[] = [
  {
    id: "free",
    label: "Free",
    priceDisplay: "$0",
    priceSuffix: "/month",
    audience: "Try AniDachi and join friends in their rooms",
    summary: "Crunchyroll + YouTube — join free, host with a daily limit",
    features: [
      "Crunchyroll + YouTube",
      `Host your own room: ${freeHostMins} min/day`,
      `Up to ${freePolicy.maxParticipants} people (incl. host)`,
      `Up to ${freePolicy.maxCameras} cameras & ${freePolicy.maxMicrophones} mics`,
      "Join friends' rooms",
      "Sync, chat & reactions",
      "Friends, groups & invites",
      "View saved history & resume",
      "Recording & editing require Plus or Pro",
    ],
  },
  {
    id: "plus",
    label: "Plus",
    priceDisplay: PRICING_PLUS_LABEL,
    priceSuffix: "/month",
    audience: "Regular watch nights and your personal watch progress",
    summary: "No daily host limit — record progress on both platforms",
    features: [
      "Crunchyroll + YouTube",
      "Host your own room: no daily limit",
      `Up to ${plusPolicy.maxParticipants} people (incl. host)`,
      `Up to ${plusPolicy.maxCameras} cameras & ${plusPolicy.maxMicrophones} mics`,
      "Record & edit progress on both platforms",
      "Resume from saved spot",
      "Join friends' rooms",
      "Sync, chat & reactions",
      "Friends, groups & invites",
    ],
  },
  {
    id: "pro",
    label: "Pro",
    priceDisplay: PRICING_PRO_LABEL,
    priceSuffix: "/month",
    audience: "Bigger groups, clubs, and hosts who need priority support",
    summary: `Same as Plus — up to ${proPolicy.maxParticipants} people and ${proPolicy.maxMicrophones} mics, plus priority support`,
    features: [
      "Everything in Plus",
      `Up to ${proPolicy.maxParticipants} people (incl. host)`,
      `Up to ${proPolicy.maxCameras} cameras & ${proPolicy.maxMicrophones} mics`,
      "Priority support",
      "Custom pricing for 8+ person groups",
    ],
  },
];

export function pricingTierById(id: PricingTierId): PricingTierMarketing {
  const tier = PRICING_TIERS.find((entry) => entry.id === id);
  if (!tier) throw new Error(`Unknown pricing tier: ${id}`);
  return tier;
}
