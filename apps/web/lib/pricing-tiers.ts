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

export const PRICING_TIERS: PricingTierMarketing[] = [
  {
    id: "free",
    label: "Free",
    priceDisplay: "$0",
    priceSuffix: "/month",
    audience: "Try AniDachi and join friends in their rooms",
    summary: "Join watchrooms, sync, and chat — pay only when you want to host without limits",
    features: [
      "Join friends' watchrooms for free",
      "Sync, chat & reactions",
      "Chrome extension access",
      "Host up to 30 min/day",
      "Up to 4 people in your room",
      "1 friend group & 3 tracked titles",
    ],
  },
  {
    id: "plus",
    label: "Plus",
    priceDisplay: PRICING_PLUS_LABEL,
    priceSuffix: "/month",
    audience: "Regular watch nights with friends, sync, chat, and shared progress",
    summary: "Host without the free time limit, invite friends, and use up to 4 video seats",
    features: [
      "Unlimited watchrooms",
      "Up to 6 people in your room",
      "Up to 4 video seats",
      "Real-time chat & discussions",
      "Cross-device playback sync",
      "Watch history & progress (3 months)",
      "Priority support",
    ],
  },
  {
    id: "pro",
    label: "Pro",
    priceDisplay: PRICING_PRO_LABEL,
    priceSuffix: "/month",
    audience: "Club hosts and bigger groups who need private rooms and moderator controls",
    summary: "Bigger groups, longer history, invite-only rooms, and host controls",
    features: [
      "Everything in Plus",
      "Up to 15 people in your room",
      "Invite-only rooms (private links + approval)",
      "Host & moderator controls (kick/ban, lock playback)",
      "Room personalization (name, cover, pinned notes)",
      "Watch history up to 12 months",
      "Founder badge + fast-track support",
    ],
  },
];

export function pricingTierById(id: PricingTierId): PricingTierMarketing {
  const tier = PRICING_TIERS.find((entry) => entry.id === id);
  if (!tier) throw new Error(`Unknown pricing tier: ${id}`);
  return tier;
}
