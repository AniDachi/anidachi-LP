import { getPlanPolicy } from "@anidachi/protocol";
import {
  PRICING_PLUS_SHORT,
  PRICING_PRO_SHORT,
} from "@/lib/pricing-tiers";

export {
  PRICING_PLUS_SHORT,
  PRICING_PRO_SHORT,
  PRICING_STARTING_AT,
} from "@/lib/pricing-tiers";

const plusPolicy = getPlanPolicy("plus");
const proPolicy = getPlanPolicy("pro");

/** Honest room-size range for SEO / FAQ copy (matches getPlanPolicy). */
export const PRICING_ROOM_SIZE_RANGE = `up to ${plusPolicy.maxParticipants} people with a Plus host or ${proPolicy.maxParticipants} with a Pro host (including the host; friends join free)`;

/** Async is planned — never sell it as a current paid differentiator. */
export const ASYNC_COMING_SOON =
  "Async catch-up is coming soon in a later batch";

/** Public copy for the paid-hosting model; legacy quota policy is not a Free offer. */
export const PRICING_HOST_MODEL =
  "Only the host needs Plus or Pro, including during a trial. Friends join on Free accounts, and the host's plan sets the room limits. Recording and editing personal watch progress require each viewer’s own Plus or Pro access. Saved history and Resume remain available on Free. Both Crunchyroll and YouTube are supported.";

export const PRICING_TRIAL_NOTE =
  "New and existing Free accounts that have not used a trial can try Plus or Pro once for 3 days with a card. After that, your chosen monthly or yearly plan renews automatically unless you cancel renewal before the trial ends.";

export const PRICING_CANCELLATION_NOTE =
  "Cancel renewal from Account → Subscription. Access continues until your current trial or paid period ends.";

export const PRICING_IS_ANIDACHI_FREE_ANSWER =
  `Yes — you can join a Plus, Pro or trial host's room for free. Creating your own rooms and recording personal watch progress require your own Plus or Pro access. ${PRICING_TRIAL_NOTE} See the pricing page for monthly and yearly prices. ${PRICING_CANCELLATION_NOTE}`;

export const PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER =
  `No. ${PRICING_HOST_MODEL} Each person still needs their own access to the video on Crunchyroll.`;

export const PRICING_PLUS_VS_PRO_ANSWER =
  `Plus supports one host and up to ${plusPolicy.maxParticipants - 1} friends, with ${plusPolicy.maxCameras} cameras and ${plusPolicy.maxMicrophones} microphones. Pro supports one host and up to ${proPolicy.maxParticipants - 1} friends, with ${proPolicy.maxCameras} cameras, ${proPolicy.maxMicrophones} microphones and priority support. Friends join for free. Both plans include hosting without a daily time limit and personal watch history on Crunchyroll and YouTube. Monthly and yearly billing are available. ${PRICING_TRIAL_NOTE}`;

export function pricingWatchPageFaqAnswer(animeTitle: string): string {
  return `You can join a Plus, Pro or trial host's room for free. To create your own room, choose Plus or Pro. ${PRICING_TRIAL_NOTE} Each person still needs their own Crunchyroll access to ${animeTitle}; AniDachi adds sync and chat to each person's stream.`;
}

export const PRICING_COMPARE_OVERVIEW =
  `Friends join for free. Hosting your own room and recording personal watch history require Plus or Pro, including during a trial. Both plans support Crunchyroll and YouTube, with monthly and yearly billing. ${ASYNC_COMING_SOON}.`;

export const PRICING_ASYNC_HOST_SNIPPET =
  `${ASYNC_COMING_SOON}. Today, host a live watchroom with Plus or Pro and invite friends for free. Each viewer needs their own Plus or Pro access to record personal watch progress.`;

export const PRICING_TELEPARTY_COMPARE_FAQ =
  `Teleparty has a free tier for basic live sync, plus a premium tier. With AniDachi, friends join for free and the host needs Plus or Pro, including during a trial. Both plans support Crunchyroll and YouTube. Personal history recording requires each viewer's own Plus or Pro access. ${ASYNC_COMING_SOON}.`;

export const PRICING_RAVE_COMPARE_FAQ =
  `Rave offers a free tier with basic sync and chat. AniDachi lets friends join a Plus, Pro or trial host for free. Plus and Pro include hosting and personal history recording, with monthly and yearly billing. ${ASYNC_COMING_SOON}.`;

export const PRICING_DISCORD_COMPARE_FAQ =
  `Discord offers screen sharing, but protected players may restrict capture. With AniDachi, each viewer uses their own access to the title on Crunchyroll. The host needs Plus or Pro, including during a trial; friends join for free. AniDachi syncs the separate players and adds chat and live reactions.`;

/** YouTube cluster — do not reuse Crunchyroll-only pricing FAQs on YT pages. */
export const PRICING_IS_ANIDACHI_FREE_YOUTUBE_ANSWER =
  `Yes — you can join a Plus, Pro or trial host's YouTube room for free. Creating your own rooms and recording personal watch progress require your own Plus or Pro access. ${PRICING_TRIAL_NOTE} ${PRICING_CANCELLATION_NOTE}`;

export const PRICING_FRIENDS_NEED_YOUTUBE_ANSWER =
  `No. ${PRICING_HOST_MODEL} Each person opens the same full YouTube watch page in their own browser — AniDachi syncs the room; it does not re-stream the video.`;

export const PRICING_DISCORD_COMPARE_YOUTUBE_FAQ =
  `Discord Go Live shares the host's video. AniDachi syncs each person's own full youtube.com/watch player, so everyone uses their own access to the video. The host needs Plus or Pro, including during a trial; friends join for free. You can keep Discord open for voice.`;

export const PRICING_TELEPARTY_COMPARE_YOUTUBE_FAQ =
  `Teleparty has a free tier for basic live YouTube sync, plus a premium tier. With AniDachi, the host needs Plus or Pro, including during a trial, and friends join for free. AniDachi supports live rooms on full YouTube watch pages and Crunchyroll, with personal history recording for each viewer with Plus or Pro. ${ASYNC_COMING_SOON}.`;

export const PRICING_RAVE_COMPARE_YOUTUBE_FAQ =
  `Rave offers a free tier with basic sync and chat. AniDachi lets friends join a Plus, Pro or trial host's YouTube room for free. Plus and Pro include hosting and personal history recording on full watch pages. Monthly and yearly billing are available. ${ASYNC_COMING_SOON}.`;

export const PRICING_COMPARE_OVERVIEW_YOUTUBE =
  `Friends join YouTube rooms for free. Hosting your own room and recording personal watch history require Plus or Pro, including during a trial. Monthly and yearly billing are available. ${ASYNC_COMING_SOON}.`;

export const PRICING_YT_PRICING_SNIPPET =
  `Free to join a Plus, Pro or trial host. Creating your own room requires Plus or Pro — see /pricing for monthly, yearly and trial options.`;

/** Crunchyroll cluster — short pricing line for non-canonical free FAQs. */
export const PRICING_CR_PRICING_SNIPPET =
  PRICING_YT_PRICING_SNIPPET;

export const PRICING_FREE_TIER_TABLE = "Free to join; Plus / Pro to host";
export const PRICING_HOST_PRICING_TABLE = "Plus / Pro (including trial); friends join free";
export const PRICING_PRICE_TABLE = `Free to join; host with Plus ${PRICING_PLUS_SHORT} or Pro ${PRICING_PRO_SHORT}. Yearly options available`;
/** Compare-table Pricing cell — Free + Plus + Pro. */
export const PRICING_PLUS_PRICE_LINE = PRICING_PRICE_TABLE;
export const PRICING_AMAZON_SUBSCRIPTION_ROW = PRICING_PRICE_TABLE;

export const PRICING_FIRST_CHECKLIST_FAQ =
  `Friends join for free. The person creating the room needs Plus or Pro, including during a trial. ${PRICING_TRIAL_NOTE} Everyone still needs their own access to the episode on Crunchyroll.`;

export const PRICING_GROUP_ONBOARDING =
  "Each viewer needs their own access to the episode on Crunchyroll. Only the host needs AniDachi Plus or Pro, including during a trial; friends join on Free accounts. Everyone keeps their streaming login private.";

export const PRICING_LONG_DISTANCE_SNIPPET =
  `Host a live room with Plus or Pro and invite friends for free. Each viewer's own Plus or Pro access enables personal progress recording, including when watching alone. ${ASYNC_COMING_SOON}.`;

export const PRICING_CRUNCHYROLL_GUIDE_PAID_MENTION =
  "AniDachi (live sync and chat; friends join free, Plus or Pro required to host, including during a trial)";
