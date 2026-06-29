import assert from "node:assert/strict";
import test from "node:test";
import {
  HOST_SEGMENT_CAP_SECONDS,
  MIN_SESSION_START_SECONDS,
  ROOM_TOKEN_TTL_SECONDS,
  canStartHostSession,
  computeQuotaView,
  hostRoomTokenTtlSeconds,
  isMeteredPlan,
  isSegmentStale,
  meteredSegmentStartedAt,
  nextUtcMidnight,
  openSegmentSeconds,
  planDailyHostSeconds,
  utcDayOf,
} from "./room-quota";

const NOW = new Date("2026-06-12T20:00:00.000Z");

function segmentStartedSecondsAgo(seconds: number, guestHasJoined = true) {
  return {
    startedAt: new Date(NOW.getTime() - seconds * 1000),
    guestHasJoined,
  };
}

test("free plan is metered at 30 minutes, paid plans are not", () => {
  assert.equal(planDailyHostSeconds("free"), 30 * 60);
  assert.equal(planDailyHostSeconds("watcher"), 30 * 60);
  assert.equal(isMeteredPlan("free"), true);
  assert.equal(isMeteredPlan("watcher"), true);
  assert.equal(isMeteredPlan("plus"), false);
  assert.equal(isMeteredPlan("pro"), false);
});

test("unknown plans fall back to the most restrictive quota", () => {
  assert.equal(planDailyHostSeconds("mystery-plan"), 30 * 60);
  assert.equal(isMeteredPlan("mystery-plan"), true);
});

test("solo host segments (no joined guest) never burn quota", () => {
  assert.equal(
    openSegmentSeconds(segmentStartedSecondsAgo(600, false), NOW),
    0
  );
});

test("metered segment starts only after the first guest joins", () => {
  const hostConnectedAt = new Date(NOW.getTime() - 10 * 60 * 1000);
  const firstGuestJoinedAt = new Date(NOW.getTime() - 2 * 60 * 1000);

  assert.equal(meteredSegmentStartedAt(hostConnectedAt, null), null);
  assert.equal(
    meteredSegmentStartedAt(hostConnectedAt, firstGuestJoinedAt)?.toISOString(),
    firstGuestJoinedAt.toISOString()
  );
});

test("metered segment starts at reconnect when a guest was already a member", () => {
  const firstGuestJoinedAt = new Date(NOW.getTime() - 10 * 60 * 1000);
  const hostReconnectedAt = new Date(NOW.getTime() - 2 * 60 * 1000);

  assert.equal(
    meteredSegmentStartedAt(hostReconnectedAt, firstGuestJoinedAt)?.toISOString(),
    hostReconnectedAt.toISOString()
  );
});

test("open segments are charged in real time and capped at one token life", () => {
  assert.equal(openSegmentSeconds(segmentStartedSecondsAgo(600), NOW), 600);
  assert.equal(
    openSegmentSeconds(segmentStartedSecondsAgo(10_000), NOW),
    HOST_SEGMENT_CAP_SECONDS
  );
});

test("clock skew (segment started in the future) charges nothing", () => {
  assert.equal(openSegmentSeconds(segmentStartedSecondsAgo(-30), NOW), 0);
});

test("segments become stale exactly at the cap", () => {
  assert.equal(
    isSegmentStale(segmentStartedSecondsAgo(HOST_SEGMENT_CAP_SECONDS - 1), NOW),
    false
  );
  assert.equal(
    isSegmentStale(segmentStartedSecondsAgo(HOST_SEGMENT_CAP_SECONDS), NOW),
    true
  );
});

test("quota view sums persisted and open usage, never below zero remaining", () => {
  const view = computeQuotaView({
    plan: "free",
    persistedSecondsToday: 25 * 60,
    openSegments: [segmentStartedSecondsAgo(10 * 60)],
    now: NOW,
  });
  assert.equal(view.usedSeconds, 35 * 60);
  assert.equal(view.remainingSeconds, 0);
});

test("quota view for paid plans reports infinite remaining", () => {
  const view = computeQuotaView({
    plan: "pro",
    persistedSecondsToday: 100_000,
    openSegments: [segmentStartedSecondsAgo(1_000)],
    now: NOW,
  });
  assert.equal(view.remainingSeconds, Number.POSITIVE_INFINITY);
  assert.equal(canStartHostSession(view), true);
});

test("a session can start with any positive remaining quota", () => {
  const base = {
    plan: "free",
    openSegments: [],
    now: NOW,
  };
  const blocked = computeQuotaView({
    ...base,
    persistedSecondsToday: 30 * 60,
  });
  const allowed = computeQuotaView({
    ...base,
    persistedSecondsToday: 30 * 60 - 1,
  });
  assert.equal(canStartHostSession(blocked), false);
  assert.equal(canStartHostSession(allowed), true);
});

test("free host tokens are capped to remaining quota with a floor", () => {
  const plenty = computeQuotaView({
    plan: "free",
    persistedSecondsToday: 0,
    openSegments: [],
    now: NOW,
  });
  assert.equal(hostRoomTokenTtlSeconds(plenty), ROOM_TOKEN_TTL_SECONDS);

  const nineHundredLeft = computeQuotaView({
    plan: "free",
    persistedSecondsToday: 30 * 60 - 900,
    openSegments: [],
    now: NOW,
  });
  assert.equal(hostRoomTokenTtlSeconds(nineHundredLeft), 900);

  const oneSecondLeft = computeQuotaView({
    plan: "free",
    persistedSecondsToday: 30 * 60 - 1,
    openSegments: [],
    now: NOW,
  });
  assert.equal(hostRoomTokenTtlSeconds(oneSecondLeft), MIN_SESSION_START_SECONDS);

  const paid = computeQuotaView({
    plan: "plus",
    persistedSecondsToday: 0,
    openSegments: [],
    now: NOW,
  });
  assert.equal(hostRoomTokenTtlSeconds(paid), ROOM_TOKEN_TTL_SECONDS);
});

test("utc day math handles the midnight boundary", () => {
  const lateEvening = new Date("2026-06-12T23:59:59.000Z");
  assert.equal(utcDayOf(lateEvening), "2026-06-12");
  assert.equal(
    nextUtcMidnight(lateEvening).toISOString(),
    "2026-06-13T00:00:00.000Z"
  );

  const justAfterMidnight = new Date("2026-06-13T00:00:01.000Z");
  assert.equal(utcDayOf(justAfterMidnight), "2026-06-13");
  assert.equal(
    nextUtcMidnight(justAfterMidnight).toISOString(),
    "2026-06-14T00:00:00.000Z"
  );
});

test("reset time is the next utc midnight", () => {
  const view = computeQuotaView({
    plan: "free",
    persistedSecondsToday: 0,
    openSegments: [],
    now: NOW,
  });
  assert.equal(view.resetAt, "2026-06-13T00:00:00.000Z");
});
