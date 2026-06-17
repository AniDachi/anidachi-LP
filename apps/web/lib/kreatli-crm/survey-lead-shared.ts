import {
  recommendedTierForSurvey,
  type HomeSurveyAnswers,
} from "@/lib/home-survey";
import type { Contact } from "./types";

export const SURVEY_LEAD_SEGMENT = "survey_lead";

export function isSurveyLead(contact: Contact): boolean {
  return contact.segments.includes(SURVEY_LEAD_SEGMENT);
}

export type ParsedSurveyTags = Partial<
  Record<
    | "segment"
    | "priority"
    | "timing"
    | "group_size"
    | "current_solution"
    | "discovery",
    string
  >
>;

export const SURVEY_FIELD_LABELS: Record<keyof ParsedSurveyTags, string> = {
  segment: "Who",
  priority: "Priority",
  timing: "Timing",
  group_size: "Group size",
  current_solution: "Current tool",
  discovery: "Discovery",
};

export function parseSurveyTags(segments: string[]): ParsedSurveyTags {
  const tags: ParsedSurveyTags = {};
  for (const s of segments) {
    const m = s.match(
      /^(segment|priority|timing|group_size|current_solution|discovery):(.+)$/,
    );
    if (m) tags[m[1] as keyof ParsedSurveyTags] = m[2]!;
  }
  return tags;
}

export function formatSurveyValue(raw: string): string {
  const labels: Record<string, string> = {
    Friend_group_host: "Friend group",
    Long_distance_watch: "Long distance",
    Community_mod: "Community / server",
    sync_and_no_spoilers: "Stay in sync (no spoilers)",
    chat_and_reactions: "Chat + reactions",
    async_progress: "Async progress tracking",
    host_controls: "Host controls",
    today: "Today",
    this_week: "This week",
    planning_ahead: "Planning ahead",
    just_researching: "Just researching",
    "2_3": "2–3 people",
    "4_8": "4–8 people",
    "9_plus": "9+ people",
    discord_screen_share: "Discord screen share",
    teleparty_watch2gether: "Teleparty / Watch2Gether",
    nothing_yet: "Nothing yet",
    another_tool: "Another watch-party tool",
    other: "Other",
    google_search: "Google search",
    reddit: "Reddit",
    discord: "Discord",
    friend: "Friend",
  };
  return labels[raw] ?? raw.replace(/_/g, " ");
}

export function tagsToHomeSurveyAnswers(
  tags: ParsedSurveyTags,
): HomeSurveyAnswers {
  return {
    segment:
      (tags.segment as HomeSurveyAnswers["segment"]) ?? "Friend_group_host",
    priority: tags.priority as HomeSurveyAnswers["priority"],
    timing: tags.timing as HomeSurveyAnswers["timing"],
    group_size: tags.group_size as HomeSurveyAnswers["group_size"],
    current_solution:
      tags.current_solution as HomeSurveyAnswers["current_solution"],
    discovery: tags.discovery as HomeSurveyAnswers["discovery"],
  };
}

export function recommendedPlanLabelForTags(tags: ParsedSurveyTags): string {
  const tier = recommendedTierForSurvey(tagsToHomeSurveyAnswers(tags));
  return tier === "anime_junkie" ? "Anime junkie" : "Crunchyroll subscriber";
}

export function isHighIntentTiming(timing?: string): boolean {
  return timing === "today" || timing === "this_week";
}

function escapeDelimited(value: string, delimiter: string): string {
  if (delimiter === "\t") {
    return value.replace(/\t/g, " ").replace(/\n/g, " ");
  }
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function surveyLeadsToDelimited(
  contacts: Contact[],
  delimiter: "," | "\t" = ",",
): string {
  const header = [
    "email",
    "captured_at",
    "status",
    "who",
    "priority",
    "timing",
    "group_size",
    "current_tool",
    "discovery",
    "recommended_plan",
  ];
  const esc = (s: string) => escapeDelimited(s, delimiter);
  const lines = [header.join(delimiter)];

  for (const c of contacts.filter(isSurveyLead)) {
    const tags = parseSurveyTags(c.segments);
    lines.push(
      [
        esc(c.email),
        esc(c.updated_at),
        esc(c.status),
        esc(tags.segment ? formatSurveyValue(tags.segment) : ""),
        esc(tags.priority ? formatSurveyValue(tags.priority) : ""),
        esc(tags.timing ? formatSurveyValue(tags.timing) : ""),
        esc(tags.group_size ? formatSurveyValue(tags.group_size) : ""),
        esc(
          tags.current_solution ? formatSurveyValue(tags.current_solution) : "",
        ),
        esc(tags.discovery ? formatSurveyValue(tags.discovery) : ""),
        esc(recommendedPlanLabelForTags(tags)),
      ].join(delimiter),
    );
  }

  return lines.join("\n");
}
