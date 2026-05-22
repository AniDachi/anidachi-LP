import type { Contact } from "./types";

export const SURVEY_LEAD_SEGMENT = "survey_lead";

export function isSurveyLead(contact: Contact): boolean {
  return contact.segments.includes(SURVEY_LEAD_SEGMENT);
}

export type ParsedSurveyTags = Partial<
  Record<
    "segment" | "priority" | "timing" | "group_size" | "current_solution" | "discovery",
    string
  >
>;

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
