import {
  recommendedTierForSurvey,
  type HomeSurveyAnswers,
} from "@/lib/home-survey";
import type { Contact } from "./types";

export const SURVEY_LEAD_SEGMENT = "survey_lead";
export const REFERRAL_BUMP_SPOTS = 10;

const REF_CODE_PREFIX = "ref_code:";
const REFERRALS_PREFIX = "referrals:";
const REFERRED_BY_PREFIX = "referred_by:";

export function generateRefCode(contactId: string): string {
  return contactId.replace(/-/g, "").slice(0, 8).toLowerCase();
}

export function parseRefCode(segments: string[]): string | null {
  for (const s of segments) {
    if (s.startsWith(REF_CODE_PREFIX)) {
      return s.slice(REF_CODE_PREFIX.length);
    }
  }
  return null;
}

export function getReferralCount(segments: string[]): number {
  for (const s of segments) {
    const m = s.match(/^referrals:(\d+)$/);
    if (m) return Number.parseInt(m[1]!, 10);
  }
  return 0;
}

export function setReferralCount(segments: string[], count: number): string[] {
  const next = segments.filter((s) => !s.startsWith(REFERRALS_PREFIX));
  if (count > 0) next.push(`${REFERRALS_PREFIX}${count}`);
  return next;
}

export function withRefCodeSegment(segments: string[], contactId: string): string[] {
  if (parseRefCode(segments)) return segments;
  return [...segments, `${REF_CODE_PREFIX}${generateRefCode(contactId)}`];
}

export function findContactByRefCode(
  contacts: Contact[],
  code: string,
): Contact | null {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;
  return (
    contacts.find(
      (c) => parseRefCode(c.segments)?.toLowerCase() === normalized,
    ) ?? null
  );
}

export function findSurveyLeadByEmail(
  contacts: Contact[],
  email: string,
): Contact | null {
  const normalized = email.trim().toLowerCase();
  return (
    contacts.find(
      (c) =>
        isSurveyLead(c) && c.email.trim().toLowerCase() === normalized,
    ) ?? null
  );
}

export function buildReferralJoinUrl(origin: string, refCode: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/join?ref=${encodeURIComponent(refCode)}`;
}

export function effectiveWaitlistPositionForEmail(
  contacts: Contact[],
  email: string,
): number | null {
  const base = waitlistPositionForEmail(contacts, email);
  if (base === null) return null;
  const contact = findSurveyLeadByEmail(contacts, email);
  if (!contact) return base;
  const bump = getReferralCount(contact.segments) * REFERRAL_BUMP_SPOTS;
  return Math.max(1, base - bump);
}

export function waitlistLeadSummary(
  contacts: Contact[],
  email: string,
  siteOrigin: string,
): {
  baseWaitlistPosition: number | null;
  waitlistPosition: number | null;
  referralCode: string | null;
  referralLink: string | null;
  referralCount: number;
} {
  const contact = findSurveyLeadByEmail(contacts, email);
  const baseWaitlistPosition = waitlistPositionForEmail(contacts, email);
  const waitlistPosition = effectiveWaitlistPositionForEmail(contacts, email);
  const referralCode = contact ? parseRefCode(contact.segments) : null;
  const referralCount = contact ? getReferralCount(contact.segments) : 0;
  const referralLink = referralCode
    ? buildReferralJoinUrl(siteOrigin, referralCode)
    : null;
  return {
    baseWaitlistPosition,
    waitlistPosition,
    referralCode,
    referralLink,
    referralCount,
  };
}

export function isSurveyLead(contact: Contact): boolean {
  return contact.segments.includes(SURVEY_LEAD_SEGMENT);
}

/** Survey leads in waitlist order (first email submission = #1). */
export function listSurveyLeads(contacts: Contact[]): Contact[] {
  return contacts
    .filter(isSurveyLead)
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function countSurveyLeads(contacts: Contact[]): number {
  return listSurveyLeads(contacts).length;
}

export function waitlistPositionForEmail(
  contacts: Contact[],
  email: string,
): number | null {
  const normalized = email.trim().toLowerCase();
  const ordered = listSurveyLeads(contacts);
  const idx = ordered.findIndex(
    (c) => c.email.trim().toLowerCase() === normalized,
  );
  return idx === -1 ? null : idx + 1;
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
  return tier === "pro" ? "Pro" : "Plus";
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
