import type { Contact, ContactStatus } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

const STATUSES: ContactStatus[] = [
  "active",
  "replied",
  "booked",
  "closed",
  "dnc",
];

export function parseStatus(s: string): ContactStatus | null {
  const t = s.trim().toLowerCase() as ContactStatus;
  return STATUSES.includes(t) ? t : null;
}

/** Normalize a partial contact for storage; does not assign id/timestamps. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertValidContact(c: Partial<Contact>): string | null {
  if (!c.email || !isValidEmail(c.email)) return "Invalid or missing email";
  if (c.status && !parseStatus(c.status)) return "Invalid status";
  return null;
}
