import { randomUUID } from "crypto";
import type { HomeSurveyAnswers } from "@/lib/home-survey";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  SURVEY_LEAD_SEGMENT,
  countSurveyLeads,
  findContactByRefCode,
  findSurveyLeadByEmail,
  getReferralCount,
  parseRefCode,
  setReferralCount,
  waitlistLeadSummary,
  withRefCodeSegment,
} from "./survey-lead-shared";
import { readContacts, writeContacts } from "./store";
import type { Contact } from "./types";
import { isValidEmail, normalizeEmail } from "./validation";

function mergeSegments(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

function buildSurveySegments(
  survey: Partial<HomeSurveyAnswers>,
  signupSource?: "referral" | "survey",
): string[] {
  const segments = [SURVEY_LEAD_SEGMENT];
  if (signupSource) segments.push(`signup_source:${signupSource}`);
  if (survey.segment) segments.push(`segment:${survey.segment}`);
  if (survey.priority) segments.push(`priority:${survey.priority}`);
  if (survey.timing) segments.push(`timing:${survey.timing}`);
  if (survey.group_size) segments.push(`group_size:${survey.group_size}`);
  if (survey.current_solution)
    segments.push(`current_solution:${survey.current_solution}`);
  if (survey.discovery) segments.push(`discovery:${survey.discovery}`);
  return segments;
}

function buildSurveyNote(
  survey: Partial<HomeSurveyAnswers>,
  name?: string,
  opts?: { referredBy?: string; viaReferralLink?: boolean },
): string {
  if (opts?.viaReferralLink) {
    return [
      "Joined waitlist via referral link (OAuth).",
      `Name: ${name?.trim() || "—"}`,
      `Referred by: ${opts.referredBy ?? "—"}`,
      `Captured: ${new Date().toISOString()}`,
    ].join("\n");
  }

  return [
    "Saved plan recommendation from homepage survey.",
    `Name: ${name?.trim() || "—"}`,
    `Segment: ${survey.segment ?? "—"}`,
    `Priority: ${survey.priority ?? "—"}`,
    `Group size: ${survey.group_size ?? "—"}`,
    `Timing: ${survey.timing ?? "—"}`,
    `Current solution: ${survey.current_solution ?? "—"}`,
    `Discovery: ${survey.discovery ?? "—"}`,
    `Captured: ${new Date().toISOString()}`,
  ].join("\n");
}

function creditReferrer(
  contacts: Contact[],
  referrerCode: string,
  newLeadEmail: string,
): boolean {
  const referrer = findContactByRefCode(contacts, referrerCode);
  if (!referrer) return false;
  if (normalizeEmail(referrer.email) === normalizeEmail(newLeadEmail)) {
    return false;
  }

  const idx = contacts.findIndex((c) => c.id === referrer.id);
  if (idx === -1) return false;

  const count = getReferralCount(referrer.segments) + 1;
  contacts[idx] = {
    ...contacts[idx]!,
    segments: setReferralCount(contacts[idx]!.segments, count),
    updated_at: new Date().toISOString(),
  };
  return true;
}

export type UpsertSurveyLeadOptions = {
  referredBy?: string;
  creditReferral?: boolean;
  signupSource?: "referral" | "survey";
  viaReferralLink?: boolean;
};

export type SurveyLeadResult = {
  saved: boolean;
  reason?: string;
  waitlistCount: number;
  isNewLead: boolean;
  baseWaitlistPosition: number | null;
  waitlistPosition: number | null;
  referralCode: string | null;
  referralLink: string | null;
  referralCount: number;
};

function buildResult(
  contacts: Contact[],
  email: string,
  saved: boolean,
  isNewLead: boolean,
  extra?: Partial<SurveyLeadResult>,
): SurveyLeadResult {
  const summary = waitlistLeadSummary(
    contacts,
    email,
    getResolvedSiteOrigin(),
  );
  return {
    saved,
    waitlistCount: countSurveyLeads(contacts),
    isNewLead,
    ...summary,
    ...extra,
  };
}

/** Upsert a survey email + answers into Kreatli CRM contacts. */
export async function upsertSurveyLead(
  email: string,
  survey: Partial<HomeSurveyAnswers>,
  name?: string,
  opts?: UpsertSurveyLeadOptions,
): Promise<SurveyLeadResult> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    const contacts = await readContacts();
    return buildResult(contacts, normalized, false, false, {
      reason: "invalid_email",
      baseWaitlistPosition: null,
      waitlistPosition: null,
      referralCode: null,
      referralLink: null,
      referralCount: 0,
    });
  }

  const contacts = await readContacts();
  const idx = contacts.findIndex(
    (c) => normalizeEmail(c.email) === normalized,
  );
  const now = new Date().toISOString();
  const trimmedName = name?.trim() ?? "";
  const referredBy = opts?.referredBy?.trim() ?? "";
  const isNewLead = idx === -1;

  let segments = buildSurveySegments(survey, opts?.signupSource);
  const surveyNote = buildSurveyNote(survey, trimmedName, {
    referredBy: referredBy || undefined,
    viaReferralLink: opts?.viaReferralLink,
  });

  if (isNewLead) {
    const id = randomUUID();
    if (referredBy) segments.push(`referred_by:${referredBy}`);
    segments = withRefCodeSegment(segments, id);
    const contact: Contact = {
      id,
      email: normalized,
      company: "",
      first_name: trimmedName,
      segments,
      notes: surveyNote,
      status: "active",
      next_action_date: null,
      created_at: now,
      updated_at: now,
    };
    contacts.push(contact);

    if (opts?.creditReferral && referredBy) {
      creditReferrer(contacts, referredBy, normalized);
    }
  } else {
    const cur = contacts[idx]!;
    const mergedNotes = cur.notes.trim()
      ? `${cur.notes.trim()}\n\n---\n${surveyNote}`
      : surveyNote;
    segments = mergeSegments(cur.segments, segments);
    segments = withRefCodeSegment(segments, cur.id);
    contacts[idx] = {
      ...cur,
      first_name: trimmedName || cur.first_name,
      segments,
      notes: mergedNotes,
      updated_at: now,
    };
  }

  try {
    await writeContacts(contacts);
  } catch (error) {
    console.error("[survey-lead] Failed to write contacts:", error);
    const persisted = await readContacts();
    const persistedLead = persisted.find(
      (c) => normalizeEmail(c.email) === normalized,
    );
    const summary = waitlistLeadSummary(
      persisted,
      normalized,
      getResolvedSiteOrigin(),
    );
    return {
      saved: false,
      reason: "write_failed",
      waitlistCount: countSurveyLeads(persisted),
      isNewLead: false,
      ...summary,
      referralCode: persistedLead
        ? parseRefCode(persistedLead.segments)
        : null,
      referralLink: persistedLead
        ? waitlistLeadSummary(persisted, normalized, getResolvedSiteOrigin())
            .referralLink
        : null,
    };
  }

  return buildResult(contacts, normalized, true, isNewLead);
}

export type AccountWaitlistStatus = {
  waitlistPosition: number;
  referralLink: string;
  referralCount: number;
};

/** Waitlist position + referral link for a signed-in user's email. */
export async function getAccountWaitlistStatus(
  email: string,
): Promise<AccountWaitlistStatus | null> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) return null;

  let contacts = await readContacts();
  const lead = findSurveyLeadByEmail(contacts, normalized);
  if (!lead) return null;

  if (!parseRefCode(lead.segments)) {
    const idx = contacts.findIndex((c) => c.id === lead.id);
    if (idx !== -1) {
      contacts[idx] = {
        ...contacts[idx]!,
        segments: withRefCodeSegment(contacts[idx]!.segments, contacts[idx]!.id),
        updated_at: new Date().toISOString(),
      };
      await writeContacts(contacts);
      contacts = await readContacts();
    }
  }

  const summary = waitlistLeadSummary(
    contacts,
    normalized,
    getResolvedSiteOrigin(),
  );
  if (summary.waitlistPosition === null || !summary.referralLink) {
    return null;
  }

  return {
    waitlistPosition: summary.waitlistPosition,
    referralLink: summary.referralLink,
    referralCount: summary.referralCount,
  };
}
