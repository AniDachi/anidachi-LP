import { getPlanPolicy } from "@anidachi/protocol";
import {
  PRICING_PLUS_SHORT,
  PRICING_PRO_SHORT,
  PRICING_STARTING_AT,
} from "@/lib/pricing-tiers";

export {
  PRICING_PLUS_SHORT,
  PRICING_PRO_SHORT,
  PRICING_STARTING_AT,
} from "@/lib/pricing-tiers";

const freePolicy = getPlanPolicy("free");
const plusPolicy = getPlanPolicy("plus");
const proPolicy = getPlanPolicy("pro");

/** Honest room-size range for SEO / FAQ copy (matches getPlanPolicy). */
export const PRICING_ROOM_SIZE_RANGE = `2–${proPolicy.maxParticipants} people depending on plan (Free up to ${freePolicy.maxParticipants}, Plus up to ${plusPolicy.maxParticipants}, Pro up to ${proPolicy.maxParticipants})`;

/** Async is planned — never sell it as a current paid differentiator. */
export const ASYNC_COMING_SOON =
  "Async catch-up is coming soon in a later batch";

/** Paid plans upgrade the host's room limits; guests can stay on Free. */
export const PRICING_HOST_MODEL =
  "Free hosts can start limited rooms; Plus and Pro upgrade the host's room limits while friends can join on Free accounts. Recording and editing personal progress require each viewer’s own Plus or Pro plan. Saved history and Resume remain available on Free. Crunchyroll and YouTube are available on every plan.";

export const PRICING_CANCELLATION_NOTE =
  "Cancel renewal from Account → Subscription. Paid access continues until the end of your billing period.";

export const PRICING_IS_ANIDACHI_FREE_ANSWER =
  `Yes — friends can join watchrooms on a Free account. When you want to host your own rooms without the 30-minute daily limit, Plus starts at ${PRICING_STARTING_AT} and Pro at ${PRICING_PRO_SHORT.replace("/mo", "/month")}. Cancel renewal from your account. ${PRICING_HOST_MODEL} ${PRICING_CANCELLATION_NOTE}`;

export const PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER =
  `No. ${PRICING_HOST_MODEL} Each person still needs their own Crunchyroll account to stream the video.`;

export const PRICING_PLUS_VS_PRO_ANSWER =
  `Plus (${PRICING_PLUS_SHORT}) removes the Free daily host limit, raises the room to ${plusPolicy.maxParticipants} people and ${plusPolicy.maxMicrophones} mics, and lets you record and edit personal progress on Crunchyroll and YouTube. Saved history and Resume remain available on Free. Pro (${PRICING_PRO_SHORT}) is the same features with up to ${proPolicy.maxParticipants} people and ${proPolicy.maxMicrophones} mics, plus priority support. Friends can join any host on Free. ${ASYNC_COMING_SOON} — it is not part of Plus or Pro today.`;

export function pricingWatchPageFaqAnswer(animeTitle: string): string {
  return `AniDachi has a Free tier for joining friends' rooms and hosting limited rooms. When you want to host without limits, Plus starts at ${PRICING_STARTING_AT} and Pro at ${PRICING_PRO_SHORT.replace("/mo", "/month")} — see homepage pricing and checkout. You still need individual Crunchyroll access for ${animeTitle}; AniDachi provides the watchroom, sync, and chat layer on top of each person's stream.`;
}

export const PRICING_COMPARE_OVERVIEW =
  `AniDachi has a Free tier for joining and hosting limited rooms. Hosts who need unlimited hosting and viewers who want personal history can upgrade to Plus (${PRICING_PLUS_SHORT}) or Pro (${PRICING_PRO_SHORT}). ${ASYNC_COMING_SOON}.`;

export const PRICING_ASYNC_HOST_SNIPPET =
  `${ASYNC_COMING_SOON}. Today: live watchrooms and progress tracking on paid plans — Free includes limited hosting; Plus starts at ${PRICING_STARTING_AT} — manage your subscription from your account.`;

export const PRICING_TELEPARTY_COMPARE_FAQ =
  `Teleparty has a free tier for basic live sync, plus a premium tier. AniDachi has a Free tier for joining and limited hosting, with Plus/Pro tiers for higher host limits and personal progress on Crunchyroll and YouTube. ${ASYNC_COMING_SOON}.`;

export const PRICING_RAVE_COMPARE_FAQ =
  `Rave offers a free tier with basic sync and chat. AniDachi has a Free tier for joining and limited hosting; Plus starts at ${PRICING_PLUS_SHORT} and Pro at ${PRICING_PRO_SHORT} for hosts who need unlimited hosting and personal history. ${ASYNC_COMING_SOON}.`;

export const PRICING_DISCORD_COMPARE_FAQ =
  `Discord offers screen sharing, but protected players may restrict capture. With AniDachi, each viewer needs their own access to the title on Crunchyroll. AniDachi adds watchrooms, anime detection, and live sync on top of personal Crunchyroll streams — Free for limited rooms; Plus and Pro for higher host limits. ${ASYNC_COMING_SOON}.`;

/** YouTube cluster — do not reuse Crunchyroll-only pricing FAQs on YT pages. */
export const PRICING_IS_ANIDACHI_FREE_YOUTUBE_ANSWER =
  `Yes — friends can join YouTube watchrooms on a Free account. When you want to host without the 30-minute daily limit, Plus starts at ${PRICING_STARTING_AT} and Pro at ${PRICING_PRO_SHORT.replace("/mo", "/month")}. Cancel renewal from your account. ${PRICING_HOST_MODEL} ${PRICING_CANCELLATION_NOTE}`;

export const PRICING_FRIENDS_NEED_YOUTUBE_ANSWER =
  `No. ${PRICING_HOST_MODEL} Each person opens the same full YouTube watch page in their own browser — AniDachi syncs the room; it does not re-stream the video.`;

export const PRICING_DISCORD_COMPARE_YOUTUBE_FAQ =
  `Discord Go Live can share a YouTube tab, but guests watch a compressed stream and only the host controls the player. AniDachi syncs full youtube.com/watch playback per person while Discord stays for voice — Free for limited rooms; Plus and Pro for higher host limits.`;

export const PRICING_TELEPARTY_COMPARE_YOUTUBE_FAQ =
  `Teleparty has a free tier for basic live YouTube sync, plus a premium tier. AniDachi has a Free tier for joining and limited hosting, with Plus/Pro for higher host limits and personal progress on full watch pages. ${ASYNC_COMING_SOON} — pick Teleparty for free live-only multi-platform nights; pick AniDachi for Crunchyroll + YouTube live rooms today.`;

export const PRICING_RAVE_COMPARE_YOUTUBE_FAQ =
  `Rave offers a free tier with basic sync and chat. AniDachi has a Free tier for joining and limited hosting; Plus starts at ${PRICING_PLUS_SHORT} and Pro at ${PRICING_PRO_SHORT} for hosts who need unlimited YouTube watchrooms and per-person progress on full watch pages. ${ASYNC_COMING_SOON}.`;

export const PRICING_COMPARE_OVERVIEW_YOUTUBE =
  `AniDachi has a Free tier for joining and hosting limited YouTube watchrooms. Hosts who need unlimited rooms and progress tracking can upgrade to Plus (${PRICING_PLUS_SHORT}) or Pro (${PRICING_PRO_SHORT}). ${ASYNC_COMING_SOON}.`;

export const PRICING_YT_PRICING_SNIPPET =
  `Free to join; Plus ${PRICING_PLUS_SHORT} or Pro ${PRICING_PRO_SHORT} for unlimited hosting — see /pricing.`;

/** Crunchyroll cluster — short pricing line for non-canonical free FAQs. */
export const PRICING_CR_PRICING_SNIPPET =
  `Free to join; Plus ${PRICING_PLUS_SHORT} or Pro ${PRICING_PRO_SHORT} for unlimited hosting — see /pricing.`;

export const PRICING_FREE_TIER_TABLE = "Yes (limited hosting)";
export const PRICING_HOST_PRICING_TABLE = `Free ${freeHostMinsForCopy()} min/day; Plus/Pro unlimited`;
export const PRICING_PRICE_TABLE = `Free; Plus ${PRICING_PLUS_SHORT}; Pro ${PRICING_PRO_SHORT}`;
/** Compare-table Pricing cell — Free + Plus + Pro. */
export const PRICING_PLUS_PRICE_LINE = PRICING_PRICE_TABLE;
export const PRICING_AMAZON_SUBSCRIPTION_ROW = PRICING_PRICE_TABLE;

function freeHostMinsForCopy(): number {
  return getPlanPolicy("free").dailyHostSeconds! / 60;
}

export const PRICING_FIRST_CHECKLIST_FAQ =
  `AniDachi has a Free tier for joining friends' rooms and hosting limited rooms. Hosts upgrade to Plus (${PRICING_PLUS_SHORT}) or Pro (${PRICING_PRO_SHORT}) for unlimited hosting — see homepage pricing. You still need your own Crunchyroll subscription to stream episodes; AniDachi provides watchrooms, sync, and chat on top.`;

export const PRICING_GROUP_ONBOARDING =
  "Each viewer still pays their own streaming provider. With AniDachi, Plus or Pro upgrades the host's full room limits while guests can join on Free accounts. Everyone keeps their own Crunchyroll login private.";

export const PRICING_LONG_DISTANCE_SNIPPET =
  `AniDachi has a Free tier for joining and limited hosting; Plus (${PRICING_PLUS_SHORT}) unlocks personal progress tracking for paid viewers — useful when schedules are hard to align. ${ASYNC_COMING_SOON}.`;

export const PRICING_CRUNCHYROLL_GUIDE_PAID_MENTION =
  `AniDachi (live sync + chat; Free limited hosting, Plus/Pro for higher host limits; ${ASYNC_COMING_SOON.toLowerCase()})`;
