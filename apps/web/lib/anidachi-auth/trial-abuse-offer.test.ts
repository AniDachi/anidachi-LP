import assert from "node:assert/strict";
import test from "node:test";
import { restrictTrialOffer } from "./trial-abuse-offer";
import type { PricingOffer } from "../pricing-offer";
const base = {
	ownerUserId: "owner",
	action: "trial",
	trialMode: "cardless",
	trialAvailable: true,
	validForMs: 60000,
	prices: {
		plus: { unitAmount: 799, currency: "usd" },
		pro: { unitAmount: 1499, currency: "usd" },
	},
} as PricingOffer;
test("used browser offers explicit purchase while current subscriptions and normal offers remain intact", () => {
	assert.deepEqual(restrictTrialOffer(base, true), {
		...base,
		action: "subscribe",
		trialAvailable: false,
	});
	assert.equal(restrictTrialOffer(base, false), base);
	for (const action of ["manage", "sign_in", "subscribe"] as const) {
		const offer = { ...base, action };
		assert.equal(restrictTrialOffer(offer, true), offer);
	}
});
