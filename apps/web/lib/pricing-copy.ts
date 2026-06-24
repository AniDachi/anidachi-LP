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

/** Only the host needs Plus/Pro; guests join on Free. */
export const PRICING_HOST_MODEL =
  "Only the host needs a paid plan — friends join on Free accounts and watch at the host's room limits.";

export const PRICING_REFUND_NOTE =
  "All paid subscriptions include a full refund guarantee before launch.";

export const PRICING_IS_ANIDACHI_FREE_ANSWER =
  `Yes — friends can join watchrooms on a Free account. When you want to host your own rooms without the 30-minute daily limit, Plus starts at ${PRICING_STARTING_AT} and Pro at ${PRICING_PRO_SHORT.replace("/mo", "/month")} during pre-launch (locked forever). ${PRICING_HOST_MODEL} ${PRICING_REFUND_NOTE}`;

export const PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER =
  `No. ${PRICING_HOST_MODEL} Each person still needs their own Crunchyroll account to stream the video.`;

export const PRICING_PLUS_VS_PRO_ANSWER =
  `Plus (${PRICING_PLUS_SHORT}) fits regular watch nights: unlimited hosting, up to 6 people, 4 video seats, and 3 months of watch history. Pro (${PRICING_PRO_SHORT}) adds bigger rooms (up to 15 people), invite-only rooms, moderator controls, room personalization, and 12 months of history — best for club hosts and larger groups.`;

export function pricingWatchPageFaqAnswer(animeTitle: string): string {
  return `AniDachi has a Free tier for joining friends' rooms. When you want to host without limits, Plus starts at ${PRICING_STARTING_AT} and Pro at ${PRICING_PRO_SHORT.replace("/mo", "/month")} — see homepage pricing and checkout. You still need individual Crunchyroll access for ${animeTitle}; AniDachi provides the watchroom, sync, and chat layer on top of each person's stream.`;
}

export const PRICING_COMPARE_OVERVIEW =
  `AniDachi has a Free tier for joining rooms. Hosts who need unlimited watchrooms, async catch-up, auto anime detection, and progress tracking can upgrade to Plus (${PRICING_PLUS_SHORT}) or Pro (${PRICING_PRO_SHORT}) during pre-launch.`;

export const PRICING_ASYNC_HOST_SNIPPET =
  `AniDachi offers async watching and progress tracking — free to join friends' rooms; Plus for hosts starts at ${PRICING_STARTING_AT} with a full refund guarantee.`;

export const PRICING_TELEPARTY_COMPARE_FAQ =
  "Teleparty has a free tier for basic live sync, plus a premium tier. AniDachi has a Free tier for joining rooms and Plus/Pro tiers for hosts during early access (with a clear refund path). Which is cheaper depends on whether you need multi-platform free live sync, or async progress and anime detection on Crunchyroll.";

export const PRICING_RAVE_COMPARE_FAQ =
  `Rave offers a free tier with basic sync and chat. AniDachi has a Free tier for joining rooms; Plus starts at ${PRICING_PLUS_SHORT} and Pro at ${PRICING_PRO_SHORT} during early access for hosts who need unlimited rooms, async watchrooms, auto anime detection, and per-person progress tracking.`;

export const PRICING_DISCORD_COMPARE_FAQ =
  `Discord screen sharing is bundled with their app, but you still need individual Crunchyroll access for everyone to watch legally unless one person hosts a single stream. AniDachi adds watchrooms, anime detection, sync, and async pacing on top of personal Crunchyroll streams — Free to join rooms; Plus and Pro for hosts.`;

export const PRICING_FREE_TIER_TABLE = "Yes (join rooms)";
export const PRICING_HOST_PRICING_TABLE = `Free to join; Plus ${PRICING_PLUS_SHORT} to host`;
export const PRICING_PRICE_TABLE = `Free; Plus ${PRICING_PLUS_SHORT}`;
export const PRICING_EARLY_ACCESS_PRICE = `${PRICING_PLUS_SHORT} (Plus, pre-launch)`;
export const PRICING_AMAZON_SUBSCRIPTION_ROW = "Free; Plus/Pro for hosts";

export const PRICING_FIRST_CHECKLIST_FAQ =
  `AniDachi has a Free tier for joining friends' rooms. Hosts upgrade to Plus (${PRICING_PLUS_SHORT}) or Pro (${PRICING_PRO_SHORT}) for unlimited hosting — see homepage pricing. You still need your own Crunchyroll subscription to stream episodes; AniDachi provides watchrooms, sync, and chat on top.`;

export const PRICING_GROUP_ONBOARDING =
  "Each viewer still pays their own streaming provider. With AniDachi, only the host needs Plus or Pro to unlock full room limits — guests can join on Free accounts. Everyone keeps their own Crunchyroll login private.";

export const PRICING_LONG_DISTANCE_SNIPPET =
  `AniDachi has a Free tier for joining rooms; Plus (${PRICING_PLUS_SHORT}) adds async mode, spoiler control, and progress tracking for hosts — features that matter most when schedules don't align.`;

export const PRICING_CRUNCHYROLL_GUIDE_PAID_MENTION =
  "AniDachi (sync + async + chat; Free to join, Plus/Pro to host)";
