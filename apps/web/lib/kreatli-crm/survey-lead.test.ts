import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getReferralCount } from "./survey-lead-shared";
import { upsertSurveyLead } from "./survey-lead";
import { readContacts, writeContacts } from "./store";
import type { Contact } from "./types";

function referrer(): Contact {
  return {
    id: "referrer-id",
    email: "referrer@example.com",
    company: "",
    first_name: "Referrer",
    segments: ["survey_lead", "ref_code:referrer"],
    notes: "",
    status: "active",
    next_action_date: null,
    created_at: "2026-08-23T00:00:00.000Z",
    updated_at: "2026-08-23T00:00:00.000Z",
  };
}

test("a repeated referred survey lead is idempotent", async () => {
  const dataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "anidachi-survey-lead-test-"),
  );
  const previousDataDir = process.env.CRM_DATA_DIR;
  const previousVercel = process.env.VERCEL;
  const previousToken = process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN;
  const previousStoreId = process.env.KREATLI_CRM_BLOB_STORE_ID;

  process.env.CRM_DATA_DIR = dataDir;
  delete process.env.VERCEL;
  delete process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN;
  delete process.env.KREATLI_CRM_BLOB_STORE_ID;

  try {
    await writeContacts([referrer()]);
    const input = {
      segment: "Friend_group_host" as const,
      priority: "sync_and_no_spoilers" as const,
    };
    const options = {
      referredBy: "referrer",
      creditReferral: true,
      signupSource: "referral" as const,
    };

    const first = await upsertSurveyLead(
      "new-lead@example.com",
      input,
      "New Lead",
      options,
    );
    const second = await upsertSurveyLead(
      "new-lead@example.com",
      input,
      "New Lead",
      options,
    );

    assert.equal(first.saved, true);
    assert.equal(first.isNewLead, true);
    assert.equal(second.saved, true);
    assert.equal(second.isNewLead, false);

    const contacts = await readContacts();
    const leads = contacts.filter(
      ({ email }) => email === "new-lead@example.com",
    );
    assert.equal(leads.length, 1);
    assert.equal(
      getReferralCount(
        contacts.find(({ id }) => id === "referrer-id")!.segments,
      ),
      1,
    );
    assert.equal(
      leads[0]!.notes.match(
        /Saved plan recommendation from homepage survey\./g,
      )?.length,
      1,
    );
  } finally {
    if (previousDataDir === undefined) delete process.env.CRM_DATA_DIR;
    else process.env.CRM_DATA_DIR = previousDataDir;
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
    if (previousToken === undefined) {
      delete process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN;
    } else {
      process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN = previousToken;
    }
    if (previousStoreId === undefined) {
      delete process.env.KREATLI_CRM_BLOB_STORE_ID;
    } else {
      process.env.KREATLI_CRM_BLOB_STORE_ID = previousStoreId;
    }
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
