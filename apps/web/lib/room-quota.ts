/**
 * Pure quota math for the free-plan daily host minutes (PD2 in
 * docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md).
 *
 * Semantics (Zoom-style):
 *   - only the host's own room burns quota, guests always join free;
 *   - a host "segment" starts when the host connects to their room and is
 *     metered only once at least one guest has joined the room;
 *   - one segment can never charge more than HOST_SEGMENT_CAP_SECONDS because
 *     room tokens expire after that long (v1 approximation — precise
 *     DO-reported metering replaces this in Block 6.6);
 *   - quota resets at UTC midnight; a segment is charged to the UTC day it
 *     started on.
 *
 * This module is dependency-free so it can be unit tested without Supabase.
 */

import { getPlanEntitlements } from "./anidachi-auth/plan-entitlements";

export const ROOM_TOKEN_TTL_SECONDS = 30 * 60;
export const HOST_SEGMENT_CAP_SECONDS = ROOM_TOKEN_TTL_SECONDS;
export const MIN_SESSION_START_SECONDS = 60;

/** Unknown plans get the most restrictive quota, mirroring the old `?? 1` default. */
export function planDailyHostSeconds(plan: string): number {
  const dailyHostSeconds = getPlanEntitlements(plan).room.dailyHostSeconds;
  return dailyHostSeconds === "unlimited"
    ? Number.POSITIVE_INFINITY
    : dailyHostSeconds;
}

export function isMeteredPlan(plan: string): boolean {
  return Number.isFinite(planDailyHostSeconds(plan));
}

export function utcDayOf(at: Date): string {
  return at.toISOString().slice(0, 10);
}

export function nextUtcMidnight(at: Date): Date {
  return new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 1)
  );
}

export interface HostSegment {
  startedAt: Date;
  /** v1 metering proxy: the room has at least one joined guest member. */
  guestHasJoined: boolean;
}

/** Seconds an open host segment counts toward quota right now. */
export function openSegmentSeconds(segment: HostSegment, now: Date): number {
  if (!segment.guestHasJoined) return 0;
  const elapsed = Math.floor(
    (now.getTime() - segment.startedAt.getTime()) / 1000
  );
  if (elapsed <= 0) return 0;
  return Math.min(elapsed, HOST_SEGMENT_CAP_SECONDS);
}

/** Seconds to persist when a segment closes (reconnect, end room, stale settle). */
export function settledSegmentSeconds(segment: HostSegment, now: Date): number {
  return openSegmentSeconds(segment, now);
}

/** A segment older than the cap can be settled and closed — it cannot grow further. */
export function isSegmentStale(
  segment: Pick<HostSegment, "startedAt">,
  now: Date
): boolean {
  return (
    now.getTime() - segment.startedAt.getTime() >=
    HOST_SEGMENT_CAP_SECONDS * 1000
  );
}

export interface QuotaView {
  limitSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  /** ISO timestamp of the next UTC midnight, when the quota resets. */
  resetAt: string;
}

export function computeQuotaView(params: {
  plan: string;
  persistedSecondsToday: number;
  openSegments: HostSegment[];
  now: Date;
}): QuotaView {
  const limitSeconds = planDailyHostSeconds(params.plan);
  const openSeconds = params.openSegments.reduce(
    (sum, segment) => sum + openSegmentSeconds(segment, params.now),
    0
  );
  const usedSeconds = Math.max(0, params.persistedSecondsToday) + openSeconds;
  const remainingSeconds = Number.isFinite(limitSeconds)
    ? Math.max(0, limitSeconds - usedSeconds)
    : Number.POSITIVE_INFINITY;

  return {
    limitSeconds,
    usedSeconds,
    remainingSeconds,
    resetAt: nextUtcMidnight(params.now).toISOString(),
  };
}

/** Starting a host session needs a minimum slice so tokens are never absurdly short. */
export function canStartHostSession(view: QuotaView): boolean {
  return view.remainingSeconds >= MIN_SESSION_START_SECONDS;
}

/** Free hosts get room tokens capped to their remaining quota. */
export function hostRoomTokenTtlSeconds(view: QuotaView): number {
  if (!Number.isFinite(view.remainingSeconds)) return ROOM_TOKEN_TTL_SECONDS;
  return Math.max(
    MIN_SESSION_START_SECONDS,
    Math.min(ROOM_TOKEN_TTL_SECONDS, Math.floor(view.remainingSeconds))
  );
}
