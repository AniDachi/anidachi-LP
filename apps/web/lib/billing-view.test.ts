import assert from "node:assert/strict";
import test from "node:test";
import {
	formatBillingTime,
	subscriptionDateLabel,
	subscriptionStatusLabel,
	type BillingSubscription,
} from "./billing-view";

test("scheduled end of a cardless trial is not displayed as a canceled subscription", () => {
	const subscription: BillingSubscription = {
		id: "local",
		planCode: "plus",
		status: "trialing",
		currentPeriodEnd: "2030-01-04T00:00:00Z",
		cancelAtPeriodEnd: true,
		canCancel: false,
		trial: {
			mode: "cardless",
			renewalState: "not_enabled",
			endsAt: "2030-01-04T00:00:00Z",
			pendingUntil: "2030-01-04T02:00:00Z",
			stage: "trial",
		},
	};
	assert.equal(subscriptionStatusLabel(subscription), "Free trial");
	assert.equal(subscriptionDateLabel(subscription), "Trial ends");
	assert.equal(
		subscriptionStatusLabel({
			...subscription,
			trial: { ...subscription.trial!, mode: undefined },
		}),
		"Renewal canceled",
	);
	assert.equal(
		subscriptionStatusLabel({
			...subscription,
			status: "canceled",
			trial: { ...subscription.trial!, stage: "ended" },
		}),
		"Trial ended",
	);
	assert.equal(
		subscriptionStatusLabel({
			...subscription,
			status: "active",
			trial: { ...subscription.trial!, stage: "ended" },
		}),
		"Trial ended",
	);
});

test("billing deadlines include the viewer's timezone", () => {
	const value = "2030-01-04T00:00:00Z";
	const zone = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
		.formatToParts(new Date(value))
		.find((p) => p.type === "timeZoneName")!.value;
	assert.ok(formatBillingTime(value).includes(zone));
});
