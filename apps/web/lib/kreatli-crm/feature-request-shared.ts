export const FEATURE_REQUEST_SEGMENT = "feature_request";

/** CRM Survey leads tab includes these (without polluting waitlist `survey_lead`). */
export function hasFeatureRequestSegment(segments: string[]): boolean {
  return segments.includes(FEATURE_REQUEST_SEGMENT);
}

export const FEATURE_REQUEST_CATEGORIES = [
  "watchrooms",
  "sync",
  "async",
  "platforms",
  "billing",
  "other",
] as const;

export type FeatureRequestCategory =
  (typeof FEATURE_REQUEST_CATEGORIES)[number];

export type FeatureRequestRecord = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  title: string;
  description: string;
  category: FeatureRequestCategory;
};

export function isFeatureRequestCategory(
  value: unknown,
): value is FeatureRequestCategory {
  return (
    typeof value === "string" &&
    (FEATURE_REQUEST_CATEGORIES as readonly string[]).includes(value)
  );
}
