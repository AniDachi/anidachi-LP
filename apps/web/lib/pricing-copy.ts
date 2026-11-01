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
export const PRICING_ROOM_SIZE_RANGE = `up to 4 people on Free, ${plusPolicy.maxParticipants} people with a Plus host or ${proPolicy.maxParticipants} with a Pro host (including the host; friends join free)`;

/** Async is planned — never sell it as a current paid differentiator. */
export const ASYNC_COMING_SOON =
  "Async catch-up is coming soon in a later batch";

/** Public Free20 offer; the deployed legacy runtime policy remains separate. */
export const PRICING_FREE20_SUMMARY =
  "Free includes 20 host minutes per UTC day for up to 4 people, including the host. Plus and Pro include hosting without a daily time limit.";

export const PRICING_FREE20_METERING_NOTE =
  "Time counts while the host and at least one guest are present, including while video is paused. Waiting alone uses no time. The shared account allowance resets at 00:00 UTC with no carryover. Joining a friend's room does not spend your own hosting allowance.";

export const PRICING_HISTORY_NOTE =
  "Free can read, Resume and delete saved history. Recording and editing progress require each viewer's own Plus or Pro access.";

export const PRICING_FREE20_MEDIA_NOTE =
  "Free rooms have four media seats and support four simultaneous cameras. A granted media seat permits camera and microphone use after an explicit local device action.";

export const PRICING_HOST_MODEL =
  `${PRICING_FREE20_SUMMARY} Friends join on Free accounts, and the host's plan sets the room limits. ${PRICING_HISTORY_NOTE} Crunchyroll, YouTube, and Netflix are supported.`;

export const PRICING_EXISTING_TRIAL_NOTE =
  "New trials are no longer offered. Existing trials keep their original end date and renewal terms.";

export const PRICING_CANCELLATION_NOTE =
  "Cancel renewal from Account → Subscription. Access continues until your current trial or paid period ends.";

export const PRICING_IS_ANIDACHI_FREE_ANSWER =
  `Yes. ${PRICING_FREE20_SUMMARY} ${PRICING_FREE20_METERING_NOTE} ${PRICING_HISTORY_NOTE} See the pricing page for monthly and yearly prices. ${PRICING_CANCELLATION_NOTE}`;

export const PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER =
  `No. ${PRICING_HOST_MODEL} Each person still needs their own access to the video on Crunchyroll.`;

export const PRICING_PLUS_VS_PRO_ANSWER =
  `Plus supports one host and up to ${plusPolicy.maxParticipants - 1} friends, with ${plusPolicy.maxCameras} cameras and ${plusPolicy.maxMicrophones} microphones. Pro supports one host and up to ${proPolicy.maxParticipants - 1} friends, with ${proPolicy.maxCameras} cameras, ${proPolicy.maxMicrophones} microphones and priority support. Friends join for free. Both plans include hosting without a daily time limit and personal watch history on Crunchyroll, YouTube, and Netflix. Monthly and yearly billing are available.`;

export function pricingWatchPageFaqAnswer(animeTitle: string): string {
  return `${PRICING_FREE20_SUMMARY} Friends join for free. Each person still needs their own Crunchyroll access to ${animeTitle}; AniDachi adds sync and chat to each person's stream.`;
}

export const PRICING_COMPARE_OVERVIEW =
  `${PRICING_FREE20_SUMMARY} Friends join for free. ${PRICING_HISTORY_NOTE} All three plans support Crunchyroll, YouTube, and Netflix. Plus and Pro offer monthly and yearly billing. ${ASYNC_COMING_SOON}.`;

export const PRICING_ASYNC_HOST_SNIPPET =
  `${ASYNC_COMING_SOON}. ${PRICING_FREE20_SUMMARY} Invite friends for free. Each viewer needs their own Plus or Pro access to record personal watch progress.`;

export const PRICING_TELEPARTY_COMPARE_FAQ =
  `Teleparty's free version covers services such as Netflix and YouTube; its support FAQ (checked 20 Oct 2026) says Crunchyroll parties and voice or video chat need Teleparty Premium. With AniDachi, ${PRICING_FREE20_SUMMARY} Friends join for free. All three plans support Crunchyroll, YouTube, and Netflix. Personal history recording requires each viewer's own Plus or Pro access. ${ASYNC_COMING_SOON}.`;

export const PRICING_RAVE_COMPARE_FAQ =
  `Rave offers a free tier with basic sync and chat. AniDachi friends join for free. ${PRICING_FREE20_SUMMARY} Plus and Pro include hosting and personal history recording, with monthly and yearly billing. ${ASYNC_COMING_SOON}.`;

export const PRICING_DISCORD_COMPARE_FAQ =
  `Discord offers screen sharing, but protected players may restrict capture. With AniDachi, each viewer uses their own access to the title on Crunchyroll. ${PRICING_FREE20_SUMMARY} Friends join for free. AniDachi syncs the separate players and adds chat and live reactions.`;

/** YouTube cluster — do not reuse Crunchyroll-only pricing FAQs on YT pages. */
export const PRICING_IS_ANIDACHI_FREE_YOUTUBE_ANSWER =
  `Yes. ${PRICING_FREE20_SUMMARY} ${PRICING_FREE20_METERING_NOTE} ${PRICING_HISTORY_NOTE} ${PRICING_CANCELLATION_NOTE}`;

export const PRICING_FRIENDS_NEED_YOUTUBE_ANSWER =
  `No. ${PRICING_HOST_MODEL} Each person opens the same full YouTube watch page in their own browser — AniDachi syncs the room; it does not re-stream the video.`;

export const PRICING_DISCORD_COMPARE_YOUTUBE_FAQ =
  `Discord Go Live shares the host's video. AniDachi syncs each person's own full youtube.com/watch player, so everyone uses their own access to the video. ${PRICING_FREE20_SUMMARY} Friends join for free. You can keep Discord open for voice.`;

export const PRICING_TELEPARTY_COMPARE_YOUTUBE_FAQ =
  `Teleparty has a free tier for basic live YouTube sync, plus a premium tier. With AniDachi, ${PRICING_FREE20_SUMMARY} Friends join for free. AniDachi supports live rooms on full YouTube watch pages and Crunchyroll, with personal history recording for each viewer with Plus or Pro. ${ASYNC_COMING_SOON}.`;

export const PRICING_RAVE_COMPARE_YOUTUBE_FAQ =
  `Rave offers a free tier with basic sync and chat. AniDachi friends join YouTube rooms for free. ${PRICING_FREE20_SUMMARY} Plus and Pro include hosting and personal history recording on full watch pages. Monthly and yearly billing are available. ${ASYNC_COMING_SOON}.`;

export const PRICING_COMPARE_OVERVIEW_YOUTUBE =
  `${PRICING_FREE20_SUMMARY} Friends join YouTube rooms for free. ${PRICING_HISTORY_NOTE} Monthly and yearly billing are available. ${ASYNC_COMING_SOON}.`;

export const PRICING_YT_PRICING_SNIPPET =
  `${PRICING_FREE20_SUMMARY} Friends join for free. See /pricing for monthly and yearly options.`;

/** Crunchyroll cluster — short pricing line for non-canonical free FAQs. */
export const PRICING_CR_PRICING_SNIPPET =
  PRICING_YT_PRICING_SNIPPET;

export const PRICING_FREE_TIER_TABLE = "Free: 20 host minutes per UTC day, up to 4 people; Plus / Pro: no daily hosting time limit";
export const PRICING_HOST_PRICING_TABLE = PRICING_FREE_TIER_TABLE;
export const PRICING_PRICE_TABLE = `Free: 20 host minutes per UTC day for up to 4 people; Plus ${PRICING_PLUS_SHORT} or Pro ${PRICING_PRO_SHORT}. Yearly options available`;
/** Compare-table Pricing cell — Free + Plus + Pro. */
export const PRICING_PLUS_PRICE_LINE = PRICING_PRICE_TABLE;
export const PRICING_AMAZON_SUBSCRIPTION_ROW = PRICING_PRICE_TABLE;

export const PRICING_FIRST_CHECKLIST_FAQ =
  `${PRICING_FREE20_SUMMARY} Friends join for free. Everyone still needs their own access to the episode on Crunchyroll.`;

export const PRICING_GROUP_ONBOARDING =
  `Each viewer needs their own access to the episode on Crunchyroll. ${PRICING_FREE20_SUMMARY} Friends join on Free accounts. Everyone keeps their streaming login private.`;

export const PRICING_LONG_DISTANCE_SNIPPET =
  `${PRICING_FREE20_SUMMARY} Invite friends for free. Each viewer's own Plus or Pro access enables personal progress recording, including when watching alone. ${ASYNC_COMING_SOON}.`;

export const PRICING_CRUNCHYROLL_GUIDE_PAID_MENTION =
  `AniDachi (live sync and chat; ${PRICING_FREE20_SUMMARY} Friends join free)`;
