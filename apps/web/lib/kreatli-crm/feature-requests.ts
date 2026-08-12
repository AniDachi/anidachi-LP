import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  appendPublicBlobJsonlLine,
  readPublicBlobJsonlText,
} from "@/lib/kreatli-crm/blob-jsonl";
import {
  FEATURE_REQUEST_SEGMENT,
  type FeatureRequestCategory,
  type FeatureRequestRecord,
} from "@/lib/kreatli-crm/feature-request-shared";
import { getCrmDataDir, readContacts, writeContacts } from "@/lib/kreatli-crm/store";
import type { Contact } from "@/lib/kreatli-crm/types";
import { isValidEmail, normalizeEmail } from "@/lib/kreatli-crm/validation";

export {
  FEATURE_REQUEST_CATEGORIES,
  FEATURE_REQUEST_SEGMENT,
  isFeatureRequestCategory,
  type FeatureRequestCategory,
  type FeatureRequestRecord,
} from "@/lib/kreatli-crm/feature-request-shared";

const FEATURE_REQUESTS_BLOB_PATH = "kreatli-crm/feature-requests.jsonl";

function blobToken(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN ?? null;
}

function localPath(): string {
  return path.join(getCrmDataDir(), "feature-requests.jsonl");
}

async function appendLocal(line: string): Promise<void> {
  const dir = getCrmDataDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(localPath(), `${line}\n`, "utf8");
}

async function readArchiveText(): Promise<string> {
  const token = blobToken();
  if (token) {
    try {
      return await readPublicBlobJsonlText(FEATURE_REQUESTS_BLOB_PATH, token);
    } catch (error) {
      console.error(
        "[feature-requests] Blob read failed; trying local store",
        error,
      );
    }
  }
  try {
    return await fs.readFile(localPath(), "utf8");
  } catch {
    return "";
  }
}

function parseFeatureRequests(raw: string): FeatureRequestRecord[] {
  const out: FeatureRequestRecord[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as FeatureRequestRecord;
      if (
        typeof row.id === "string" &&
        typeof row.email === "string" &&
        typeof row.title === "string"
      ) {
        out.push(row);
      }
    } catch {
      // skip bad lines
    }
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listFeatureRequests(): Promise<FeatureRequestRecord[]> {
  return parseFeatureRequests(await readArchiveText());
}

function buildNote(record: FeatureRequestRecord): string {
  return [
    "Feature request from /feature-requests",
    `Title: ${record.title}`,
    `Category: ${record.category}`,
    `Description: ${record.description}`,
    `Captured: ${record.created_at}`,
  ].join("\n");
}

async function upsertFeatureRequestContact(
  record: FeatureRequestRecord,
): Promise<{ saved: boolean; reason?: string }> {
  const email = normalizeEmail(record.email);
  if (!isValidEmail(email)) {
    return { saved: false, reason: "invalid_email" };
  }

  const now = new Date().toISOString();
  const contacts = await readContacts();
  const idx = contacts.findIndex((c) => normalizeEmail(c.email) === email);

  if (idx >= 0) {
    const existing = contacts[idx]!;
    const segments = [
      ...new Set([...existing.segments, FEATURE_REQUEST_SEGMENT]),
    ];
    const notes = [existing.notes?.trim(), buildNote(record)]
      .filter(Boolean)
      .join("\n\n---\n\n");
    contacts[idx] = {
      ...existing,
      first_name:
        existing.first_name || record.name.split(/\s+/)[0] || record.name,
      segments,
      notes,
      updated_at: now,
    };
  } else {
    const contact: Contact = {
      id: randomUUID(),
      email,
      company: "",
      first_name: record.name.split(/\s+/)[0] || record.name,
      segments: [FEATURE_REQUEST_SEGMENT],
      notes: buildNote(record),
      status: "active",
      next_action_date: null,
      created_at: now,
      updated_at: now,
    };
    contacts.push(contact);
  }

  await writeContacts(contacts);
  return { saved: true };
}

export async function appendFeatureRequest(
  input: Omit<FeatureRequestRecord, "id" | "created_at"> & {
    category: FeatureRequestCategory;
  },
): Promise<FeatureRequestRecord> {
  const record: FeatureRequestRecord = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    ...input,
  };
  const line = JSON.stringify(record);

  const token = blobToken();
  if (token) {
    try {
      await appendPublicBlobJsonlLine(FEATURE_REQUESTS_BLOB_PATH, line, token);
    } catch (error) {
      console.error(
        "[feature-requests] Blob append failed; falling back to local store",
        error,
      );
      await appendLocal(line);
    }
  } else {
    await appendLocal(line);
  }

  try {
    await upsertFeatureRequestContact(record);
  } catch (error) {
    console.error("[feature-requests] CRM upsert failed", error);
  }

  return record;
}
