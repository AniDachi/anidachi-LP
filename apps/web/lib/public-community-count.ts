import { db } from "@/lib/anidachi-auth/db";

// Owner-approved historical total: 555 accounts + 854 waitlist records.
// This is a signup baseline, not a deduplicated count of people. Keep its
// timestamp fixed across deployments so registrations since the measurement
// are included exactly once. Each environment reads only its own database.
const BASELINE_COUNT = 1409;
const BASELINE_AT = "2026-09-29T18:03:46.456294Z";

/** Server-only aggregate; no account rows or CRM contacts reach the browser. */
export async function getPublicCommunityCount(): Promise<number> {
  const { count, error } = await db()
    .from("users")
    .select("id", { count: "exact", head: true })
    .gt("created_at", BASELINE_AT)
    .abortSignal(AbortSignal.timeout(2500));

  if (
    error ||
    count === null ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    !Number.isSafeInteger(BASELINE_COUNT + count)
  ) {
    throw new Error("Community signup count is unavailable");
  }

  return BASELINE_COUNT + count;
}
