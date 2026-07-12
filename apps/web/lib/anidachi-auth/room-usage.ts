import {
  computeQuotaView,
  isMeteredPlan,
  utcDayOf,
  type QuotaView,
} from "@/lib/room-quota";
import { getUsageSecondsForDay } from "./db";

/**
 * Durable room usage is finalized atomically by `finalize_room_usage`. Open
 * room time stays in the room Durable Object and reaches the extension through
 * ROOM_SNAPSHOT, so this Web view reads only committed daily usage.
 */
export async function getHostQuotaView(
  userId: string,
  plan: string,
  now: Date
): Promise<QuotaView> {
  if (!isMeteredPlan(plan)) {
    return computeQuotaView({
      plan,
      persistedSecondsToday: 0,
      now,
    });
  }

  const persistedSecondsToday = await getUsageSecondsForDay(
    userId,
    utcDayOf(now)
  );

  return computeQuotaView({
    plan,
    persistedSecondsToday,
    now,
  });
}

export function quotaExhaustedResponseBody(view: QuotaView): {
  error: string;
  code: "QUOTA_EXHAUSTED";
  resetAt: string;
  remainingSeconds: number;
} {
  return {
    error: "Daily free watch-party time is used up",
    code: "QUOTA_EXHAUSTED",
    resetAt: view.resetAt,
    remainingSeconds: 0,
  };
}

export function quotaSummaryForResponse(
  plan: string,
  view: QuotaView
): { remainingSeconds: number; resetAt: string } | null {
  if (!isMeteredPlan(plan)) return null;
  return { remainingSeconds: view.remainingSeconds, resetAt: view.resetAt };
}
