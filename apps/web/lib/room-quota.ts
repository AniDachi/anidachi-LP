/**
 * Pure quota math for the free-plan daily host minutes (PD2 in
 * docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md).
 *
 * The room Durable Object owns open-room time. This module only computes the
 * daily view from usage already finalized atomically in Supabase.
 *
 * This module is dependency-free so it can be unit tested without Supabase.
 */

import { getPlanEntitlements } from "./anidachi-auth/plan-entitlements";

export const ROOM_TOKEN_TTL_SECONDS = 30 * 60;
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
  now: Date;
}): QuotaView {
  const limitSeconds = planDailyHostSeconds(params.plan);
  const usedSeconds = Math.max(0, params.persistedSecondsToday);
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

/** Starting a host session only requires some positive Free quota remaining. */
export function canStartHostSession(view: QuotaView): boolean {
  return view.remainingSeconds > 0;
}

/** Free hosts get room tokens capped to their remaining quota. */
export function hostRoomTokenTtlSeconds(view: QuotaView): number {
  if (!Number.isFinite(view.remainingSeconds)) return ROOM_TOKEN_TTL_SECONDS;
  return Math.max(
    MIN_SESSION_START_SECONDS,
    Math.min(ROOM_TOKEN_TTL_SECONDS, Math.floor(view.remainingSeconds))
  );
}
