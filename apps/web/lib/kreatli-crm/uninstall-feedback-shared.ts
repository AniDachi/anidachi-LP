import { UNINSTALL_REASONS, type UninstallReason } from "../anidachi-auth/uninstall-offer";

export const FEEDBACK_PAGE_SIZE = 50;
export const feedbackReasonLabels: Record<UninstallReason, string> = {
  not_using: "I don’t use it enough",
  technical_issues: "Something didn’t work",
  too_expensive: "Too expensive",
  missing_features: "Missing a feature",
  other: "Other",
};
export type FeedbackItem = {
  id: string; createdAt: string; email: string | null; discordId: string | null;
  displayName: string | null;
  reason: UninstallReason; note: string;
};
export type FeedbackPage = { items: FeedbackItem[]; nextCursor: string | null };
export const isFeedbackId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
export const isFeedbackTime = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));

export function parseFeedbackItem(raw: unknown): FeedbackItem {
  const item = raw as Partial<FeedbackItem> | null;
  if (!item || !isFeedbackId(item.id) || !isFeedbackTime(item.createdAt) ||
    !UNINSTALL_REASONS.includes(item.reason as UninstallReason) || typeof item.note !== "string" || item.note.length > 500 ||
    !(item.email === null || (typeof item.email === "string" && item.email.trim().length > 0 && item.email.length <= 320)) ||
    !(item.discordId === null || (typeof item.discordId === "string" && /^[0-9]{1,20}$/.test(item.discordId)))) throw new Error("Invalid feedback");
  return {
    id: item.id, createdAt: item.createdAt, email: item.email, discordId: item.discordId,
    displayName: optionalContactText(item.displayName, 200),
    reason: item.reason as UninstallReason, note: item.note,
  };
}
// Older deployed readers may omit the additive name during a rollout/rollback.
function optionalContactText(value: unknown, maxLength: number): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || !value.trim() || Array.from(value).length > maxLength) throw new Error("Invalid feedback contact");
  return value;
}
export function parseFeedbackPage(raw: unknown): FeedbackPage {
  const page = raw as Partial<FeedbackPage> | null;
  if (!page || !Array.isArray(page.items) || page.items.length > FEEDBACK_PAGE_SIZE ||
    !(page.nextCursor === null || (typeof page.nextCursor === "string" && page.nextCursor.length > 0 && page.nextCursor.length <= 512))) throw new Error("Invalid feedback page");
  return { items: page.items.map(parseFeedbackItem), nextCursor: page.nextCursor };
}
