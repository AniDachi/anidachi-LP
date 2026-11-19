import { PRICING_FREE20_SUMMARY } from "@/lib/pricing-copy";

/**
 * Hero lead, card heading, button and line for guides that promote one watchroom (ANI-64).
 * Button labels match the platform hubs' hero buttons.
 */
export const WATCHROOM_CTA = {
  crunchyroll: {
    label: "Start a Crunchyroll Watch Party",
    lead: "Watch Crunchyroll together in sync, each on your own player.",
    body: `Add AniDachi to Chrome, open the episode on Crunchyroll and send the invite. ${PRICING_FREE20_SUMMARY}`,
  },
  anime: {
    label: "Start an Anime Watch Party",
    lead: "Watch anime together in sync on Crunchyroll or YouTube, each on your own player.",
    body: `Add AniDachi to Chrome, then open the episode on Crunchyroll or YouTube and send the invite. ${PRICING_FREE20_SUMMARY}`,
  },
  youtube: {
    label: "Start a YouTube Watch Party",
    lead: "Watch YouTube together in sync, each on your own youtube.com tab.",
    body: `Add AniDachi to Chrome, open the video on youtube.com and send the invite. ${PRICING_FREE20_SUMMARY}`,
  },
  netflix: {
    label: "Start a Netflix Watch Party",
    lead: "Watch Netflix together in sync, each with your own Netflix access.",
    body: `Add AniDachi to Chrome, open the title on Netflix and send the invite. Everyone needs their own Netflix access. ${PRICING_FREE20_SUMMARY}`,
  },
} as const;

export type Watchroom = keyof typeof WATCHROOM_CTA;
