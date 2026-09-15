import assert from "node:assert/strict";
import test from "node:test";
import {
  countSurveyLeads,
  findSurveyLeadByEmail,
  isSurveyLead,
  listSurveyLeads,
  parseSurveyTags,
  recommendedPlanLabelForTags,
  surveyLeadsToDelimited,
} from "./survey-lead-shared";
import type { Contact } from "./types";

function makeLead(
  email: string,
  createdAt: string,
  extraSegments: string[] = [],
): Contact {
  const id = `00000000-0000-4000-8000-${createdAt.padStart(12, "0")}`;
  return {
    id,
    email,
    company: "",
    first_name: "",
    segments: ["survey_lead", ...extraSegments],
    notes: "",
    status: "active",
    next_action_date: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

test("isSurveyLead requires survey_lead segment", () => {
  assert.equal(isSurveyLead(makeLead("a@example.com", "1")), true);
  assert.equal(
    isSurveyLead({
      ...makeLead("b@example.com", "2"),
      segments: ["outreach"],
    }),
    false,
  );
});

test("listSurveyLeads orders by created_at", () => {
  const contacts = [
    makeLead("second@example.com", "2026-01-02T00:00:00.000Z"),
    makeLead("first@example.com", "2026-01-01T00:00:00.000Z"),
  ];
  assert.deepEqual(
    listSurveyLeads(contacts).map((c) => c.email),
    ["first@example.com", "second@example.com"],
  );
  assert.equal(countSurveyLeads(contacts), 2);
});

test("findSurveyLeadByEmail is case-insensitive", () => {
  const contacts = [makeLead("Host@Example.com", "2026-01-01T00:00:00.000Z")];
  assert.equal(
    findSurveyLeadByEmail(contacts, "host@example.com")?.email,
    "Host@Example.com",
  );
  assert.equal(findSurveyLeadByEmail(contacts, "missing@example.com"), null);
});

test("parseSurveyTags extracts known fields", () => {
  const tags = parseSurveyTags([
    "survey_lead",
    "segment:Friend_group_host",
    "priority:sync_and_no_spoilers",
    "noise:ignored",
  ]);
  assert.deepEqual(tags, {
    segment: "Friend_group_host",
    priority: "sync_and_no_spoilers",
  });
  assert.equal(recommendedPlanLabelForTags(tags), "Plus");
});

test("surveyLeadsToDelimited exports CSV header and rows", () => {
  const csv = surveyLeadsToDelimited([
    makeLead("a@example.com", "2026-01-01T00:00:00.000Z", [
      "segment:Friend_group_host",
    ]),
  ]);
  assert.match(csv, /^email,captured_at,status,/);
  assert.match(csv, /a@example\.com/);
  assert.match(csv, /Friend group/);
});
