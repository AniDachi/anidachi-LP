import type { Contact } from "./types";

export function renderTemplate(body: string, contact: Contact): string {
  return body
    .replace(/\{\{\s*first_name\s*\}\}/gi, contact.first_name || "")
    .replace(/\{\{\s*First Name\s*\}\}/g, contact.first_name || "")
    .replace(/\{\{\s*company\s*\}\}/gi, contact.company || "")
    .replace(/\{\{\s*email\s*\}\}/gi, contact.email || "");
}
