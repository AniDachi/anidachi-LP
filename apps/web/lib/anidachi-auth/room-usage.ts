import {
  computeQuotaView,
  isMeteredPlan,
  isSegmentStale,
  meteredSegmentStartedAt,
  settledSegmentSeconds,
  utcDayOf,
  type HostSegment,
  type QuotaView,
} from "@/lib/room-quota";
import {
  getFirstRoomMemberJoinedAt,
  getOpenHostSegmentRooms,
  getUsageSecondsForDay,
  incrementUsageSeconds,
  updateRoom,
  type RoomRow,
} from "./db";

/**
 * Server-side orchestration for the PD2 daily host quota
 * (v1 approximation — precise Durable Object metering replaces this in
 * Block 6.6 of the 2026-06-12 execution plan).
 *
 * A host "segment" is open while `rooms.host_connected_at` is set. Metered
 * time starts at the later of host connect and the first guest join, charged to
 * that UTC day, and can never exceed one room-token life.
 */

async function roomSegment(room: RoomRow): Promise<HostSegment | null> {
  if (!room.host_connected_at) return null;
  const firstGuestJoinedAt = await getFirstRoomMemberJoinedAt(room.room_id);
  const startedAt = meteredSegmentStartedAt(
    new Date(room.host_connected_at),
    firstGuestJoinedAt ? new Date(firstGuestJoinedAt) : null
  );
  if (!startedAt) return null;

  return {
    startedAt,
    guestHasJoined: true,
  };
}

/**
 * Persists the room's open host segment (if any) to usage_daily.
 * Callers decide what happens to `host_connected_at` afterwards.
 */
export async function settleHostSegment(
  room: RoomRow,
  plan: string,
  now: Date
): Promise<void> {
  if (!isMeteredPlan(plan)) return;
  const segment = await roomSegment(room);
  if (!segment) return;
  const seconds = settledSegmentSeconds(segment, now);
  if (seconds > 0) {
    await incrementUsageSeconds(
      room.host_user_id,
      utcDayOf(segment.startedAt),
      seconds
    );
  }
}

/**
 * Computes the host's current quota view. As a side effect, settles and closes
 * segments that are older than the cap (they cannot grow further), so stale
 * `host_connected_at` values do not pile up.
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
      openSegments: [],
      now,
    });
  }

  const openRooms = await getOpenHostSegmentRooms(userId);
  const openSegments: HostSegment[] = [];

  for (const room of openRooms) {
    const segment = await roomSegment(room);
    if (!segment) continue;

    if (isSegmentStale(segment, now)) {
      const seconds = settledSegmentSeconds(segment, now);
      if (seconds > 0) {
        await incrementUsageSeconds(
          userId,
          utcDayOf(segment.startedAt),
          seconds
        );
      }
      await updateRoom(room.room_id, { host_connected_at: null });
    } else {
      openSegments.push(segment);
    }
  }

  const persistedSecondsToday = await getUsageSecondsForDay(
    userId,
    utcDayOf(now)
  );

  return computeQuotaView({ plan, persistedSecondsToday, openSegments, now });
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
