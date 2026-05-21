import { randomUUID } from "crypto";
import type { HomeSurveyAnswers } from "@/lib/home-survey";
import { readContacts, writeContacts } from "./store";
import type { Contact } from "./types";
import { isValidEmail, normalizeEmail } from "./validation";

function mergeSegments(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

function buildSurveySegments(survey: Partial<HomeSurveyAnswers>): string[] {
  const segments = ["survey_lead"];
  if (survey.segment) segments.push(`segment:${survey.segment}`);
  if (survey.priority) segments.push(`priority:${survey.priority}`);
  if (survey.timing) segments.push(`timing:${survey.timing}`);
  if (survey.group_size) segments.push(`group_size:${survey.group_size}`);
  if (survey.current_solution) segments.push(`current_solution:${survey.current_solution}`);
  if (survey.discovery) segments.push(`discovery:${survey.discovery}`);
  return segments;
}

function buildSurveyNote(survey: Partial<HomeSurveyAnswers>): string {
  return [
    "Saved plan recommendation from homepage survey.",
    `Segment: ${survey.segment ?? "—"}`,
    `Priority: ${survey.priority ?? "—"}`,
    `Group size: ${survey.group_size ?? "—"}`,
    `Timing: ${survey.timing ?? "—"}`,
    `Current solution: ${survey.current_solution ?? "—"}`,
    `Discovery: ${survey.discovery ?? "—"}`,
    `Captured: ${new Date().toISOString()}`,
  ].join("\n");
}

/** Upsert a survey email + answers into Kreatli CRM contacts. */
export async function upsertSurveyLead(
  email: string,
  survey: Partial<HomeSurveyAnswers>,
): Promise<{ saved: boolean; reason?: string }> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return { saved: false, reason: "invalid_email" };
  }

  const contacts = await readContacts();
  const idx = contacts.findIndex((c) => c.email === normalized);
  const now = new Date().toISOString();
  const segments = buildSurveySegments(survey);
  const surveyNote = buildSurveyNote(survey);

  if (idx === -1) {
    const contact: Contact = {
      id: randomUUID(),
      email: normalized,
      company: "",
      first_name: "",
      segments,
      notes: surveyNote,
      status: "active",
      next_action_date: null,
      created_at: now,
      updated_at: now,
    };
    contacts.push(contact);
  } else {
    const cur = contacts[idx]!;
    const mergedNotes = cur.notes.trim()
      ? `${cur.notes.trim()}\n\n---\n${surveyNote}`
      : surveyNote;
    contacts[idx] = {
      ...cur,
      segments: mergeSegments(cur.segments, segments),
      notes: mergedNotes,
      updated_at: now,
    };
  }

  await writeContacts(contacts);
  return { saved: true };
}
