import { getPlanPolicy } from "@anidachi/protocol";
import type { CheckoutTier } from "@/lib/home-survey";

export const PRICING_PLUS_MONTHLY = 7.99;
export const PRICING_PRO_MONTHLY = 14.99;

export const PRICING_PLUS_LABEL = `$${PRICING_PLUS_MONTHLY.toFixed(2)}`;
export const PRICING_PRO_LABEL = `$${PRICING_PRO_MONTHLY.toFixed(2)}`;
export const PRICING_STARTING_AT = `$${PRICING_PLUS_MONTHLY.toFixed(2)}/month`;
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

export const PRICING_TIERS: PricingTierMarketing[] = [
  {
    id: "free",
    label: "Free",
    priceDisplay: "$0",
    priceSuffix: "/month",
    audience: "Try AniDachi and join friends in their rooms",
    summary: "Join watchrooms, sync, and chat; upgrade for unlimited hosting and personal history",
    features: [
      "Crunchyroll & YouTube watchrooms",
      "Join friends' watchrooms for free",
      "Sync, chat & reactions",
      "Chrome extension access",
      `Host up to ${freePolicy.dailyHostSeconds! / 60} min/day (UTC)`,
      `Up to ${freePolicy.maxParticipants} people in your room`,
      `Up to ${freePolicy.maxCameras} cameras & ${freePolicy.maxMicrophones} microphones`,
      "1 friend group",
      "No personal watch history",
    ],
  },
  {
    id: "plus",
    label: "Plus",
    priceDisplay: PRICING_PLUS_LABEL,
    priceSuffix: "/month",
    audience: "Regular watch nights and your personal watch progress",
    summary: "Unlimited hosting and personal history, alone or in a room",
    features: [
      "Unlimited watchrooms",
      `Up to ${plusPolicy.maxParticipants} people in your room`,
      `Up to ${plusPolicy.maxCameras} cameras & ${plusPolicy.maxMicrophones} microphones`,
      "Real-time chat & discussions",
      "Cross-device playback sync",
      "Personal watch history & Resume",
      "Crunchyroll & YouTube",
      "Priority support",
    ],
  },
  {
    id: "pro",
    label: "Pro",
    priceDisplay: PRICING_PRO_LABEL,
    priceSuffix: "/month",
    audience: "Club hosts and bigger groups who need private rooms and moderator controls",
    summary: "Bigger groups and personal watch history",
    features: [
      "Everything in Plus",
      `Up to ${proPolicy.maxParticipants} people in your room`,
      `Up to ${proPolicy.maxCameras} cameras & ${proPolicy.maxMicrophones} microphones`,
      "Invite-only rooms (private links + approval)",
      "Host & moderator controls (kick/ban, lock playback)",
      "Room personalization (name, cover, pinned notes)",
      "Personal watch history & Resume",
      "Founder badge + fast-track support",
    ],
  },
];

export function pricingTierById(id: PricingTierId): PricingTierMarketing {
  const tier = PRICING_TIERS.find((entry) => entry.id === id);
  if (!tier) throw new Error(`Unknown pricing tier: ${id}`);
  return tier;
}
