import type { Contact } from "./types";

/** Queue: active contacts with next_action_date on or before today (UTC date). */
export function isContactDue(c: Contact): boolean {
  if (c.status !== "active") return false;
  if (!c.next_action_date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return c.next_action_date <= today;
}
