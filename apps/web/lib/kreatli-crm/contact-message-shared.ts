export const CONTACT_MESSAGE_SEGMENT = "contact_message";

export const CONTACT_CATEGORIES = [
  "support",
  "privacy",
  "security",
  "press",
  "corrections",
  "other",
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

export type ContactMessageRecord = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  category: ContactCategory;
};

export function isContactCategory(value: unknown): value is ContactCategory {
  return (
    typeof value === "string" &&
    (CONTACT_CATEGORIES as readonly string[]).includes(value)
  );
}
