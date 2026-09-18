import { randomUUID } from "crypto";
import { mutateContacts } from "@/lib/kreatli-crm/store";
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

  // The mutation may be replayed against fresh data after a concurrent write.
  const id = randomUUID();
  const now = new Date().toISOString();
  const note = `Requested desktop install link.\nCaptured: ${now}`;

  try {
    const outcome = await mutateContacts((contacts) => {
      const idx = contacts.findIndex((c) => normalizeEmail(c.email) === normalized);
      if (idx === -1) {
        const contact: Contact = {
          id,
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
        contacts[idx] = {
          ...cur,
          segments: mergeSegments(cur.segments, [DESKTOP_INSTALL_LINK_SEGMENT]),
          notes: cur.notes.trim() ? `${cur.notes.trim()}\n\n---\n${note}` : note,
          updated_at: now,
        };
      }
      return { changed: true, value: { saved: true } };
    });
    return outcome.value;
  } catch {
    return { saved: false, reason: "storage_failed" };
  }
}
