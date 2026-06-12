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

test("watcher plan is metered at 30 minutes, paid plans are not", () => {
  assert.equal(planDailyHostSeconds("watcher"), 30 * 60);
  assert.equal(isMeteredPlan("watcher"), true);
  assert.equal(isMeteredPlan("nakama"), false);
  assert.equal(isMeteredPlan("junkie"), false);
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
    plan: "watcher",
    persistedSecondsToday: 25 * 60,
    openSegments: [segmentStartedSecondsAgo(10 * 60)],
    now: NOW,
  });
  assert.equal(view.usedSeconds, 35 * 60);
  assert.equal(view.remainingSeconds, 0);
});

test("quota view for paid plans reports infinite remaining", () => {
  const view = computeQuotaView({
    plan: "junkie",
    persistedSecondsToday: 100_000,
    openSegments: [segmentStartedSecondsAgo(1_000)],
    now: NOW,
  });
  assert.equal(view.remainingSeconds, Number.POSITIVE_INFINITY);
  assert.equal(canStartHostSession(view), true);
});

test("a session can start only with at least one minimum slice remaining", () => {
  const base = {
    plan: "watcher",
    openSegments: [],
    now: NOW,
  };
  const blocked = computeQuotaView({
    ...base,
    persistedSecondsToday: 30 * 60 - MIN_SESSION_START_SECONDS + 1,
  });
  const allowed = computeQuotaView({
    ...base,
    persistedSecondsToday: 30 * 60 - MIN_SESSION_START_SECONDS,
  });
  assert.equal(canStartHostSession(blocked), false);
  assert.equal(canStartHostSession(allowed), true);
});

test("free host tokens are capped to remaining quota with a floor", () => {
  const plenty = computeQuotaView({
    plan: "watcher",
    persistedSecondsToday: 0,
    openSegments: [],
    now: NOW,
  });
  assert.equal(hostRoomTokenTtlSeconds(plenty), ROOM_TOKEN_TTL_SECONDS);

  const nineHundredLeft = computeQuotaView({
    plan: "watcher",
    persistedSecondsToday: 30 * 60 - 900,
    openSegments: [],
    now: NOW,
  });
  assert.equal(hostRoomTokenTtlSeconds(nineHundredLeft), 900);

  const paid = computeQuotaView({
    plan: "nakama",
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
    plan: "watcher",
    persistedSecondsToday: 0,
    openSegments: [],
    now: NOW,
  });
  assert.equal(view.resetAt, "2026-06-13T00:00:00.000Z");
});
