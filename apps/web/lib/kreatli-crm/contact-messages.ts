import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  appendPublicBlobJsonlLine,
  readPublicBlobJsonlText,
} from "@/lib/kreatli-crm/blob-jsonl";
import {
  CONTACT_MESSAGE_SEGMENT,
  type ContactCategory,
  type ContactMessageRecord,
} from "@/lib/kreatli-crm/contact-message-shared";
import {
  getCrmDataDir,
  readContacts,
  writeContacts,
} from "@/lib/kreatli-crm/store";
import type { Contact } from "@/lib/kreatli-crm/types";
import { isValidEmail, normalizeEmail } from "@/lib/kreatli-crm/validation";

export {
  CONTACT_CATEGORIES,
  CONTACT_MESSAGE_SEGMENT,
  isContactCategory,
  type ContactCategory,
  type ContactMessageRecord,
} from "@/lib/kreatli-crm/contact-message-shared";

export const CONTACT_MESSAGES_BLOB_PATH =
  "kreatli-crm/contact-messages.jsonl";

function blobToken(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN ?? null;
}

function localPath(): string {
  return path.join(getCrmDataDir(), "contact-messages.jsonl");
}

async function appendLocal(line: string): Promise<void> {
  await fs.mkdir(getCrmDataDir(), { recursive: true });
  await fs.appendFile(localPath(), `${line}\n`, "utf8");
}

async function readArchiveText(): Promise<string> {
  const token = blobToken();
  if (token) {
    try {
      return await readPublicBlobJsonlText(CONTACT_MESSAGES_BLOB_PATH, token);
    } catch (error) {
      console.error("[contact] Blob read failed; trying local store", error);
    }
  }
  try {
    return await fs.readFile(localPath(), "utf8");
  } catch {
    return "";
  }
}

function parseContactMessages(raw: string): ContactMessageRecord[] {
  const out: ContactMessageRecord[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as ContactMessageRecord;
      if (
        typeof row.id === "string" &&
        typeof row.email === "string" &&
        typeof row.subject === "string"
      ) {
        out.push(row);
      }
    } catch {
      // skip bad lines
    }
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listContactMessages(): Promise<ContactMessageRecord[]> {
  return parseContactMessages(await readArchiveText());
}

function buildNote(record: ContactMessageRecord): string {
  return [
    "Contact form message from /contact",
    `Category: ${record.category}`,
    `Subject: ${record.subject}`,
    `Message: ${record.message}`,
    `Captured: ${record.created_at}`,
  ].join("\n");
}

async function upsertContactMessageContact(
  record: ContactMessageRecord,
): Promise<void> {
  const email = normalizeEmail(record.email);
  if (!isValidEmail(email)) return;

  const now = new Date().toISOString();
  const contacts = await readContacts();
  const idx = contacts.findIndex((c) => normalizeEmail(c.email) === email);

  if (idx >= 0) {
    const existing = contacts[idx]!;
    contacts[idx] = {
      ...existing,
      first_name:
        existing.first_name || record.name.split(/\s+/)[0] || record.name,
      segments: [
        ...new Set([...existing.segments, CONTACT_MESSAGE_SEGMENT]),
      ],
      notes: [existing.notes?.trim(), buildNote(record)]
        .filter(Boolean)
        .join("\n\n---\n\n"),
      updated_at: now,
    };
  } else {
    const contact: Contact = {
      id: randomUUID(),
      email,
      company: "",
      first_name: record.name.split(/\s+/)[0] || record.name,
      segments: [CONTACT_MESSAGE_SEGMENT],
      notes: buildNote(record),
      status: "active",
      next_action_date: null,
      created_at: now,
      updated_at: now,
    };
    contacts.push(contact);
  }

  await writeContacts(contacts);
}

export async function appendContactMessage(
  input: Omit<ContactMessageRecord, "id" | "created_at"> & {
    category: ContactCategory;
  },
): Promise<ContactMessageRecord> {
  const record: ContactMessageRecord = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    ...input,
  };
  const line = JSON.stringify(record);

  const token = blobToken();
  if (token) {
    try {
      await appendPublicBlobJsonlLine(CONTACT_MESSAGES_BLOB_PATH, line, token);
    } catch (error) {
      console.error(
        "[contact] Blob append failed; falling back to local store",
        error,
      );
      await appendLocal(line);
    }
  } else {
    await appendLocal(line);
  }

  try {
    await upsertContactMessageContact(record);
  } catch (error) {
    console.error("[contact] CRM upsert failed", error);
  }

  return record;
}
