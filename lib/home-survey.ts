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

// "just_researching" kept for backwards-compat with stored surveys; new value is "planning_ahead"
export type HomeSurveyTiming = "today" | "this_week" | "planning_ahead" | "just_researching";

export type HomeSurveyGroupSize = "2_3" | "4_8" | "9_plus";

export type HomeSurveyCurrentSolution =
  | "discord_screen_share"
  | "teleparty_watch2gether"
  | "nothing_yet"
  | "another_tool"
  | "other";

export type HomeSurveyAnswers = {
  segment: HomeSurveySegment;
  priority?: HomeSurveyPriority;
  discovery?: HomeSurveyDiscovery;
  timing?: HomeSurveyTiming;
  group_size?: HomeSurveyGroupSize;
  current_solution?: HomeSurveyCurrentSolution;
};

export type CheckoutTier = "crunchyroll_subscriber" | "anime_junkie";

export function defaultHomeSurveyAnswers(): HomeSurveyAnswers {
  return { segment: "Friend_group_host" };
}

export function recommendedTierForSurvey(a: HomeSurveyAnswers): CheckoutTier {
  // If someone explicitly wants host controls, they self-identify into the higher tier.
  if (a.priority === "host_controls") return "anime_junkie";
  if (a.segment === "Community_mod") return "anime_junkie";
  if (a.group_size === "9_plus") return "anime_junkie";
  return "crunchyroll_subscriber";
}

export function primaryCtaLabelForSurvey(a: HomeSurveyAnswers): string {
  if (a.segment === "Community_mod" || a.priority === "host_controls") {
    return "See my host plan";
  }
  if (a.segment === "Long_distance_watch") {
    return "See my plan for long-distance";
  }
  return "See my recommended plan";
}

export function pricingCtaLabelForTier(opts: {
  tier: CheckoutTier;
  survey: HomeSurveyAnswers;
}): string {
  const { tier, survey } = opts;
  if (tier === "anime_junkie") return "Unlock host controls";
  if (survey.segment === "Long_distance_watch") return "Start watching together";
  if (survey.segment === "Friend_group_host") return "Start hosting watchrooms";
  return "Start paid plan";
}

/**
 * Returns the priority-specific headline feature bullet for the recommendation step.
 * This is the first (highlighted) bullet that mirrors back what the user said they care about.
 */
export function priorityFeatureBullet(priority: HomeSurveyPriority | undefined): string {
  switch (priority) {
    case "sync_and_no_spoilers":
      return "No-spoiler sync lock — everyone stays on the same episode";
    case "chat_and_reactions":
      return "Live reactions that fire exactly when a moment hits";
    case "async_progress":
      return "Progress tracker so no one gets left behind";
    case "host_controls":
      return "Full host & mod controls to run your room";
    default:
      return "Sync, chat, and reactions built for anime";
  }
}

/**
 * Returns an "upgrade from X" copy line if the user named a known alternative, or null.
 * Used to personalise the recommendation header for low-intent users.
 */
export function currentSolutionUpgradeText(
  solution: HomeSurveyCurrentSolution | undefined,
): string | null {
  switch (solution) {
    case "discord_screen_share":
      return "Upgrade from Discord screen share — no quality loss, no stream delay";
    case "teleparty_watch2gether":
      return "Upgrade from Teleparty — built for anime, not Netflix";
    case "another_tool":
      return "Switch to a platform built for anime watch-parties";
    case "nothing_yet":
    case "other":
    default:
      return null;
  }
}
