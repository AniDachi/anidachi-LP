import type { CheckoutTier } from "@/lib/pricing-tiers";

export type HomeSurveySegment =
  | "Friend_group_host"
  | "Long_distance_watch"
  | "Community_mod";

export type HomeSurveyPriority =
  | "sync_and_no_spoilers"
  | "chat_and_reactions"
  | "async_progress"
  | "host_controls";

export type HomeSurveyDiscovery =
  | "google_search"
  | "reddit"
  | "discord"
  | "friend"
  | "other";

// "just_researching" kept for backwards-compat with stored CRM survey tags.
export type HomeSurveyTiming = "today" | "this_week" | "planning_ahead" | "just_researching";

export type HomeSurveyGroupSize = "2_3" | "4_8" | "9_plus";

export type HomeSurveyCurrentSolution =
  | "discord_screen_share"
  | "teleparty_watch2gether"
  | "nothing_yet"
  | "another_tool"
  | "other";

export type HomeSurveyAnswers = {
  segment?: HomeSurveySegment;
  priority?: HomeSurveyPriority;
  discovery?: HomeSurveyDiscovery;
  timing?: HomeSurveyTiming;
  group_size?: HomeSurveyGroupSize;
  current_solution?: HomeSurveyCurrentSolution;
};

export function recommendedTierForSurvey(a: HomeSurveyAnswers): CheckoutTier {
  if (a.priority === "host_controls") return "pro";
  if (a.segment === "Community_mod") return "pro";
  if (a.group_size === "9_plus") return "pro";
  return "plus";
}
