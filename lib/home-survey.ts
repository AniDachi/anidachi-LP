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

export type HomeSurveyTiming = "today" | "this_week" | "just_researching";

export type HomeSurveyAnswers = {
  segment: HomeSurveySegment;
  priority?: HomeSurveyPriority;
  discovery?: HomeSurveyDiscovery;
  timing?: HomeSurveyTiming;
};

export type CheckoutTier = "crunchyroll_subscriber" | "anime_junkie";

export function defaultHomeSurveyAnswers(): HomeSurveyAnswers {
  return { segment: "Friend_group_host" };
}

export function recommendedTierForSurvey(a: HomeSurveyAnswers): CheckoutTier {
  // If someone explicitly wants host controls, they self-identify into the higher tier.
  if (a.priority === "host_controls") return "anime_junkie";
  if (a.segment === "Community_mod") return "anime_junkie";
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

