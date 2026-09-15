import { randomUUID } from "crypto";
import { readContacts, writeContacts } from "@/lib/kreatli-crm/store";
import type { Contact } from "@/lib/kreatli-crm/types";
import { isValidEmail, normalizeEmail } from "@/lib/kreatli-crm/validation";

export const DESKTOP_INSTALL_LINK_SEGMENT = "desktop_install_link";

function mergeSegments(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

export async function upsertDesktopInstallLead(
  email: string,
): Promise<{ saved: boolean; reason?: string }> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return { saved: false, reason: "invalid_email" };
  }

  const contacts = await readContacts();
  const now = new Date().toISOString();
  const note = `Requested desktop install link.\nCaptured: ${now}`;
  const idx = contacts.findIndex((c) => normalizeEmail(c.email) === normalized);

  if (idx === -1) {
    const contact: Contact = {
      id: randomUUID(),
      email: normalized,
      company: "",
      first_name: "",
      segments: [DESKTOP_INSTALL_LINK_SEGMENT],
      notes: note,
      status: "active",
      next_action_date: null,
      created_at: now,
      updated_at: now,
    };
    contacts.push(contact);
  } else {
    const cur = contacts[idx]!;
    const mergedNotes = cur.notes.trim()
      ? `${cur.notes.trim()}\n\n---\n${note}`
      : note;
    contacts[idx] = {
      ...cur,
      segments: mergeSegments(cur.segments, [DESKTOP_INSTALL_LINK_SEGMENT]),
      notes: mergedNotes,
      updated_at: now,
    };
  }

  try {
    await writeContacts(contacts);
    return { saved: true };
  } catch (error) {
    console.error("[desktop-install-lead] Failed to write contacts:", error);
    return { saved: false, reason: "write_failed" };
  }
}
