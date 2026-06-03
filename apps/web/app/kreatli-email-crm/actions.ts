"use server";

import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { verifyKreatliCrmSession } from "@/lib/kreatli-crm/auth";
import {
  buildImportPreview,
  contactsToCsv,
  parseImportText,
  type ImportMergeMode,
  type ImportPreviewLine,
} from "@/lib/kreatli-crm/import-merge";
import { appendTouch, crmDataDir, readContacts, writeContacts } from "@/lib/kreatli-crm/store";
import { renderTemplate } from "@/lib/kreatli-crm/template-render";
import type { Contact, ContactStatus } from "@/lib/kreatli-crm/types";

export type CrmActionState = { error?: string } | null;

async function guard() {
  if (!(await verifyKreatliCrmSession())) {
    throw new Error("Unauthorized");
  }
}

function nowIso() {
  return new Date().toISOString();
}

export async function addContactAction(
  _prev: CrmActionState,
  formData: FormData
): Promise<CrmActionState> {
  try {
    await guard();
  } catch {
    return { error: "Unauthorized" };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const company = String(formData.get("company") ?? "").trim();
  const first_name = String(formData.get("first_name") ?? "").trim();
  const segmentsRaw = String(formData.get("segments") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const next_action_date = String(formData.get("next_action_date") ?? "").trim() || null;

  if (!email) {
    return { error: "Email is required" };
  }

  const segments = segmentsRaw
    ? segmentsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const contacts = await readContacts();
  if (contacts.some((c) => c.email === email)) {
    return { error: "A contact with this email already exists" };
  }

  const t = nowIso();
  const contact: Contact = {
    id: randomUUID(),
    email,
    company,
    first_name,
    segments,
    notes,
    status: "active",
    next_action_date,
    created_at: t,
    updated_at: t,
  };
  contacts.push(contact);
  await writeContacts(contacts);
  revalidatePath("/kreatli-email-crm");
  return null;
}

export async function updateContactAction(
  _prev: CrmActionState,
  formData: FormData
): Promise<CrmActionState> {
  try {
    await guard();
  } catch {
    return { error: "Unauthorized" };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing id" };

  const status = String(formData.get("status") ?? "").trim() as ContactStatus;
  const nextRaw = String(formData.get("next_action_date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const allowed: ContactStatus[] = [
    "active",
    "replied",
    "booked",
    "closed",
    "dnc",
  ];
  if (!allowed.includes(status)) {
    return { error: "Invalid status" };
  }

  const contacts = await readContacts();
  const idx = contacts.findIndex((c) => c.id === id);
  if (idx === -1) return { error: "Contact not found" };

  contacts[idx] = {
    ...contacts[idx],
    status,
    next_action_date: nextRaw || null,
    notes,
    updated_at: nowIso(),
  };
  await writeContacts(contacts);
  revalidatePath("/kreatli-email-crm");
  return null;
}

export async function logTouchAction(
  _prev: CrmActionState,
  formData: FormData
): Promise<CrmActionState> {
  try {
    await guard();
  } catch {
    return { error: "Unauthorized" };
  }

  const contact_id = String(formData.get("contact_id") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  if (!contact_id) return { error: "Missing contact" };
  if (!summary) return { error: "Summary is required" };

  await appendTouch({
    id: randomUUID(),
    contact_id,
    sent_at: nowIso(),
    summary,
  });
  revalidatePath("/kreatli-email-crm");
  return null;
}

export async function deleteContactAction(
  _prev: CrmActionState,
  formData: FormData
): Promise<CrmActionState> {
  try {
    await guard();
  } catch {
    return { error: "Unauthorized" };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing id" };

  const contacts = await readContacts();
  const next = contacts.filter((c) => c.id !== id);
  if (next.length === contacts.length) return { error: "Contact not found" };
  await writeContacts(next);
  revalidatePath("/kreatli-email-crm");
  return null;
}

export type ImportPreviewResult =
  | {
      ok: true;
      preview: ImportPreviewLine[];
      counts: { create: number; skip: number; update: number };
    }
  | { ok: false; error: string };

export async function previewImportAction(
  formData: FormData
): Promise<ImportPreviewResult> {
  try {
    await guard();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const text = String(formData.get("import_text") ?? "");
  const mode = String(formData.get("mode") ?? "skip") as ImportMergeMode;
  if (mode !== "skip" && mode !== "upsert") {
    return { ok: false, error: "Invalid mode" };
  }
  if (!text.trim()) {
    return { ok: false, error: "Paste or upload CSV/TSV text first" };
  }

  const parsed = parseImportText(text);
  if (parsed.length === 0) {
    return { ok: false, error: "No valid rows (need an email column or @ in a column)" };
  }

  const existing = await readContacts();
  const { preview } = buildImportPreview(existing, parsed, mode);
  const counts = { create: 0, skip: 0, update: 0 };
  for (const line of preview) {
    if (line.action === "create") counts.create++;
    else if (line.action === "skip") counts.skip++;
    else counts.update++;
  }
  return { ok: true, preview, counts };
}

export async function applyImportAction(
  _prev: CrmActionState,
  formData: FormData
): Promise<CrmActionState> {
  try {
    await guard();
  } catch {
    return { error: "Unauthorized" };
  }

  const text = String(formData.get("import_text") ?? "");
  const mode = String(formData.get("mode") ?? "skip") as ImportMergeMode;
  if (mode !== "skip" && mode !== "upsert") {
    return { error: "Invalid mode" };
  }
  const parsed = parseImportText(text);
  const existing = await readContacts();
  const { nextContacts } = buildImportPreview(existing, parsed, mode);
  await writeContacts(nextContacts);
  revalidatePath("/kreatli-email-crm");
  return null;
}

export async function exportCsvDataAction(): Promise<
  { ok: true; csv: string } | { ok: false; error: string }
> {
  try {
    await guard();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const contacts = await readContacts();
  return { ok: true, csv: contactsToCsv(contacts) };
}

export async function renderTemplateCopyAction(
  templateSlug: string,
  contactId: string
): Promise<{ ok: true; body: string } | { ok: false; error: string }> {
  try {
    await guard();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const contacts = await readContacts();
  const c = contacts.find((x) => x.id === contactId);
  if (!c) return { ok: false, error: "Contact not found" };
  const safe = path.basename(templateSlug).replace(/[^a-z0-9-_]/gi, "");
  if (!safe) return { ok: false, error: "Bad template name" };
  const file = path.join(crmDataDir(), "templates", `${safe}.md`);
  try {
    const raw = await fs.readFile(file, "utf8");
    return { ok: true, body: renderTemplate(raw, c) };
  } catch {
    return { ok: false, error: "Template not found" };
  }
}
