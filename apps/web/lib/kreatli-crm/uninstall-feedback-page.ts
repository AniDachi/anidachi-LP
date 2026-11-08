import { FEEDBACK_PAGE_SIZE, isFeedbackId, isFeedbackTime, parseFeedbackItem, type FeedbackPage } from "./uninstall-feedback-shared";

export type FeedbackCursor = { createdAt: string; id: string };

export function parseFeedbackCursor(value: string | null): FeedbackCursor | null {
  if (value === null) return null;
  if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid cursor");
  const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  if (!cursor || Object.keys(cursor).length !== 2 || !isFeedbackTime(cursor.createdAt) || !isFeedbackId(cursor.id)) throw new Error("Invalid cursor");
  return { createdAt: cursor.createdAt, id: cursor.id };
}

export function feedbackPage(rows: unknown[]): FeedbackPage {
  if (rows.length > FEEDBACK_PAGE_SIZE + 1) throw new Error("Unbounded feedback page");
  const items = rows.slice(0, FEEDBACK_PAGE_SIZE).map((raw) => {
    const row = raw as Record<string, unknown>;
    // Contacts are CRM-only; internal user IDs and anti-abuse hashes stay server-side.
    return parseFeedbackItem({ id: row.submission_id, createdAt: row.created_at, email: row.email, discordId: row.discord_id, reason: row.reason, note: row.note });
  });
  const last = items.at(-1);
  const nextCursor = rows.length > FEEDBACK_PAGE_SIZE && last
    ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString("base64url")
    : null;
  return { items, nextCursor };
}
