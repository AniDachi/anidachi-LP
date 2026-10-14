import assert from "node:assert/strict";
import test from "node:test";
import type { HostingAccess } from "@anidachi/protocol";
import { readHostingOffer, type HostingOfferPolicy } from "./hosting-offer";

const serverTime = "2026-10-14T12:00:00Z";
const hosting: HostingAccess = {
  hostingPolicyVersion: 2, hostingActivationAt: serverTime, canHost: false,
  trialEligibility: "eligible", trialEndsAt: null,
};
const policy: HostingOfferPolicy = {
  activation_at: serverTime, trials_enabled: true, cardless_trials_enabled: true, revision: 2,
};
test("cardless copy requires the same active commercial policy as the access snapshot", async () => {
  assert.deepEqual(await readHostingOffer(hosting, serverTime, async () => policy), {
    trialMode: "cardless", trialDays: 3, policyRevision: 2,
  });
  for (const patch of [{revision: 3}, {trials_enabled: false}, {activation_at: null},
    {activation_at: "2026-10-15T12:00:00Z"}]) {
    assert.equal(await readHostingOffer(hosting, serverTime, async () => ({...policy, ...patch})), undefined);
  }
  assert.equal((await readHostingOffer(hosting, serverTime, async () => ({...policy, cardless_trials_enabled: false})))?.trialMode, "card_required");
});
test("paid, used, unavailable and legacy accounts need no additional policy read", async () => {
  let reads = 0;
  for (const access of [undefined, {...hosting, canHost: true},
    {...hosting, trialEligibility: "used" as const}, {...hosting, trialEligibility: "unavailable" as const}]) {
    assert.equal(await readHostingOffer(access, serverTime, async () => { reads++; return policy; }), undefined);
  }
  assert.equal(reads, 0);
});
test("failure of optional offer metadata preserves the account response", async () => {
  assert.equal(await readHostingOffer(hosting, serverTime, async () => { throw new Error("offline"); }), undefined);
});
