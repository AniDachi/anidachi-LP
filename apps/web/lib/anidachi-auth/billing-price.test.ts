import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { verifiedBillingPrice } from "./billing-price";

const annual = {
	id: "price_year",
	active: true,
	livemode: false,
	currency: "usd",
	type: "recurring",
	unit_amount: 7670,
	billing_scheme: "per_unit",
	transform_quantity: null,
	recurring: { interval: "year", interval_count: 1, usage_type: "licensed" },
} as Stripe.Price;

test("annual prices return the full charge and actual billing period", () => {
	assert.deepEqual(
		verifiedBillingPrice(annual, annual.id, false, true, "yearly"),
		{ unitAmount: 7670, currency: "usd", billingPeriod: "yearly" },
	);
	assert.throws(() =>
		verifiedBillingPrice(annual, annual.id, false, true, "monthly"),
	);
});
test("wrong mode, inactive, metered, multiyear and malformed prices fail closed", () => {
	for (const change of [
		{ livemode: true },
		{ active: false },
		{ id: "wrong" },
		{ currency: "eur" },
		{ unit_amount: 76.7 },
		{ recurring: { ...annual.recurring!, interval_count: 2 } },
		{ recurring: { ...annual.recurring!, interval: "month" } },
		{ recurring: { ...annual.recurring!, usage_type: "metered" } },
		{ recurring: null },
		{ transform_quantity: { divide_by: 2, round: "up" } },
	])
		assert.throws(() =>
			verifiedBillingPrice(
				{ ...annual, ...change } as Stripe.Price,
				annual.id,
				false,
				true,
				"yearly",
			),
		);
	assert.equal(
		verifiedBillingPrice({ ...annual, active: false }, annual.id, false)
			.billingPeriod,
		"yearly",
		"Existing subscriptions can display archived prices",
	);
});
