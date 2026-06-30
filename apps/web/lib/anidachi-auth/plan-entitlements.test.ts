import assert from "node:assert/strict";
import test from "node:test";
import {
  checkoutInputToPaidPlanCode,
  getPlanEntitlements,
  isRoomCapabilities,
  legacyTierToPlanCode,
  maxPlanCode,
  roomCapabilitiesForPlan,
} from "./plan-entitlements";

test("plan entitlements match the approved MVP pricing matrix", () => {
  const free = getPlanEntitlements("free");
  assert.equal(free.label, "Free");
  assert.equal(free.room.dailyHostSeconds, 30 * 60);
  assert.equal(free.room.maxParticipants, 4);
  assert.equal(free.room.maxMediaSeats, 4);
  assert.equal(free.account.maxOwnedGroups, 1);
  assert.equal(free.account.maxActiveTrackedTitles, 3);
  assert.equal(free.account.historyRetentionDays, 7);

  const plus = getPlanEntitlements("plus");
  assert.equal(plus.label, "Plus");
  assert.equal(plus.room.dailyHostSeconds, "unlimited");
  assert.equal(plus.room.maxParticipants, 6);
  assert.equal(plus.room.maxMediaSeats, 4);
  assert.equal(plus.account.maxOwnedGroups, 5);
  assert.equal(plus.account.maxActiveTrackedTitles, 15);
  assert.equal(plus.account.historyRetentionDays, 92);

  const pro = getPlanEntitlements("pro");
  assert.equal(pro.label, "Pro");
  assert.equal(pro.room.dailyHostSeconds, "unlimited");
  assert.equal(pro.room.maxParticipants, 15);
  assert.equal(pro.room.maxMediaSeats, 4);
  assert.equal(pro.account.maxOwnedGroups, 15);
  assert.equal(pro.account.maxActiveTrackedTitles, 50);
  assert.equal(pro.account.historyRetentionDays, 366);
});

test("unknown plan codes fall back to Free", () => {
  assert.equal(getPlanEntitlements("unknown").planCode, "free");
  assert.equal(getPlanEntitlements("watcher").planCode, "free");
  assert.equal(getPlanEntitlements("nakama").planCode, "plus");
  assert.equal(getPlanEntitlements("junkie").planCode, "pro");
});

test("room capabilities are derived from host plan entitlements", () => {
  assert.deepEqual(roomCapabilitiesForPlan("free"), {
    hostPlanCode: "free",
    maxParticipants: 4,
    maxMediaSeats: 4,
    canNameRoom: false,
    canSendPushInvites: false,
  });
  assert.deepEqual(roomCapabilitiesForPlan("pro"), {
    hostPlanCode: "pro",
    maxParticipants: 15,
    maxMediaSeats: 4,
    canNameRoom: true,
    canSendPushInvites: true,
  });
  assert.equal(isRoomCapabilities(roomCapabilitiesForPlan("plus")), true);
  assert.equal(isRoomCapabilities(roomCapabilitiesForPlan("nakama")), true);
  assert.equal(
    isRoomCapabilities({
      hostPlanCode: "pro",
      maxParticipants: 15,
      maxMediaSeats: -1,
      canNameRoom: true,
      canSendPushInvites: true,
    }),
    false
  );
});

test("legacy checkout tiers map to the new paid plan codes", () => {
  assert.equal(legacyTierToPlanCode("crunchyroll_subscriber"), "plus");
  assert.equal(legacyTierToPlanCode("anime_junkie"), "pro");
  assert.equal(legacyTierToPlanCode("watcher"), null);
});

test("checkout plan parsing accepts new planCode and legacy tier", () => {
  assert.equal(checkoutInputToPaidPlanCode({ planCode: "plus" }), "plus");
  assert.equal(checkoutInputToPaidPlanCode({ planCode: "pro" }), "pro");
  assert.equal(checkoutInputToPaidPlanCode({ planCode: "nakama" }), "plus");
  assert.equal(checkoutInputToPaidPlanCode({ planCode: "junkie" }), "pro");
  assert.equal(
    checkoutInputToPaidPlanCode({ tier: "crunchyroll_subscriber" }),
    "plus"
  );
  assert.equal(checkoutInputToPaidPlanCode({ tier: "anime_junkie" }), "pro");
  assert.equal(checkoutInputToPaidPlanCode({ planCode: "watcher" }), null);
  assert.equal(checkoutInputToPaidPlanCode({ planCode: "free" }), null);
});

test("highest active plan wins when several subscriptions exist", () => {
  assert.equal(maxPlanCode(["free", "plus"]), "plus");
  assert.equal(maxPlanCode(["pro", "plus", "free"]), "pro");
});
