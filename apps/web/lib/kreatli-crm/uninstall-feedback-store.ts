import "server-only";
import { db } from "../anidachi-auth/db";
import { feedbackPage, type FeedbackCursor } from "./uninstall-feedback-page";

export async function readUninstallFeedback(cursor: FeedbackCursor | null) {
  const { data, error } = await db().rpc("list_uninstall_feedback_v1", {
    p_before_created_at: cursor?.createdAt ?? null,
    p_before_submission_id: cursor?.id ?? null,
  }).abortSignal(AbortSignal.timeout(8000));
  if (error || !Array.isArray(data)) throw new Error("Feedback unavailable");
  return feedbackPage(data);
}
