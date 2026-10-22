import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Window } from "happy-dom";
import { BillingView } from "../app/account/billing/billing-client";
import {
	formatBillingTime,
	type BillingOverview,
	type BillingSubscription,
} from "./billing-view";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const window = new Window({
	url: "https://staging.anidachi.app/account/billing",
});
for (const [key, value] of Object.entries({
	window,
	self: window,
	document: window.document,
	navigator: window.navigator,
	HTMLElement: window.HTMLElement,
	Event: window.Event,
})) {
	Object.defineProperty(globalThis, key, {
		value,
		configurable: true,
		writable: true,
	});
}
const subscription: BillingSubscription = {
	id: "subscription-a",
	planCode: "plus",
	status: "active",
	currentPeriodEnd: "2030-02-04T16:00:00Z",
	cancelAtPeriodEnd: false,
	canCancel: true,
	price: { unitAmount: 799, currency: "usd", billingPeriod: "monthly" },
};
const trial = {
	mode: "cardless" as const,
	stage: "trial" as const,
	endsAt: "2030-01-04T16:00:00Z",
	pendingUntil: "2030-01-04T18:00:00Z",
	renewalState: "not_enabled" as const,
};
let root: Root | undefined;
let container: HTMLDivElement;
const actions: string[] = [];
async function mount(
	s: BillingSubscription | null,
	accountPlan: BillingOverview["planCode"] = "free",
	options: {
		error?: string;
		busy?: boolean;
		empty?: boolean;
		other?: BillingSubscription;
	} = {},
) {
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	await act(async () =>
		root!.render(
			React.createElement(BillingView, {
				ownerUserId: "owner",
				overview: options.empty
					? null
					: {
							ownerUserId: "owner",
							planCode: accountPlan,
							subscriptions: [
								...(s ? [s] : []),
								...(options.other ? [options.other] : []),
							],
						},
				busy: options.busy ?? false,
				error: options.error ?? null,
				notice: null,
				planQuote: null,
				load: async () => {
					actions.push("refresh");
				},
				openStripe: async (id, action) => {
					actions.push(`${id}:${action}`);
				},
				changeTrial: async () => {
					actions.push("change-plan");
				},
				setPlanQuote: () => {},
			}),
		),
	);
}
afterEach(async () => {
	await act(async () => root?.unmount());
	container?.remove();
	actions.length = 0;
});

test("discounted subscription shows the next charge and explains when yearly billing returns", async () => {
	await mount(
		{
			...subscription,
			canSwitchToYearly: false,
			promotion: {
				state: "active",
				percentOff: 40,
				endsAt: "2030-04-04T16:00:00Z",
				nextPrice: {
					unitAmount: 479,
					currency: "usd",
					billingPeriod: "monthly",
				},
			},
		},
		"plus",
	);
	const card = container.querySelector(".billing-summary-card")!;
	assert.match(card.textContent!, /\$4\.79/);
	assert.match(card.textContent!, /40% off.*Then \$7\.99/);
	await act(async () => card.querySelector("button")!.click());
	assert.match(
		container.textContent!,
		/Yearly billing is available after your discount ends/,
	);
	assert.doesNotMatch(container.textContent!, /Switch to yearly billing/);
});

test("unverified campaign billing hides the amount without hiding the paid account", async () => {
	await mount({ ...subscription, promotion: { state: "unavailable" } }, "plus");
	const card = container.querySelector(".billing-summary-card")!;
	assert.match(card.textContent!, /Active subscription/);
	assert.match(card.textContent!, /Amount unavailable/);
	assert.match(card.textContent!, /Refresh to check your discount/);
});

for (const [status, expected] of [
	["past_due", "Payment overdue"],
	["unpaid", "Unpaid"],
	["incomplete", "Payment incomplete"],
]) {
	test(`${status} has one actionable summary and no duplicate Free block`, async () => {
		await mount({ ...subscription, status });
		const card = container.querySelector(".billing-summary-card")!;
		assert.match(card.textContent!, new RegExp(expected));
		assert.match(card.textContent!, /Current account access: Free/);
		assert.equal(container.querySelectorAll(".billing-summary-card").length, 1);
		assert.equal(
			container.querySelector('[aria-label="Current access"]'),
			null,
		);
		assert.doesNotMatch(
			card.textContent!,
			/Next payment|Renews automatically|Trial ends/,
		);
		const button = card.querySelector("button")!;
		assert.match(button.textContent!, /Complete payment in Stripe/);
		assert.deepEqual(actions, []);
		await act(async () => button.click());
		assert.deepEqual(actions, ["subscription-a:payment"]);
	});
}

test("first payment processing shows the grace deadline, not a paid renewal", async () => {
	await mount(
		{ ...subscription, trial: { ...trial, stage: "processing" } },
		"plus",
	);
	const card = container.querySelector(".billing-summary-card")!;
	assert.match(card.textContent!, /First payment processing/);
	assert.ok(card.textContent!.includes(formatBillingTime(trial.pendingUntil)));
	assert.match(card.textContent!, /not yet a paid period/);
	assert.doesNotMatch(
		card.textContent!,
		/Active subscription|Next payment|Renews automatically|Complete payment/,
	);
	await act(async () => card.querySelector("button")!.click());
	assert.deepEqual(actions, ["refresh"]);
});

test("failed first payment shows recovery without an expired trial or paid claim", async () => {
	await mount({
		...subscription,
		status: "past_due",
		trial: { ...trial, stage: "payment_required" },
	});
	const card = container.querySelector(".billing-summary-card")!;
	assert.match(
		card.textContent!,
		/Payment needs attention.*Current account access: Free/,
	);
	assert.doesNotMatch(
		card.textContent!,
		/Active until|Trial ends|Next payment|Active subscription/,
	);
	await act(async () => card.querySelector("button")!.click());
	assert.deepEqual(actions, ["subscription-a:payment"]);
});

test("unavailable recovery is not offered when renewal is canceled", async () => {
	await mount({
		...subscription,
		status: "past_due",
		cancelAtPeriodEnd: true,
		canCancel: false,
	});
	const card = container.querySelector(".billing-summary-card")!;
	assert.doesNotMatch(card.textContent!, /Complete payment/);
	await act(async () => card.querySelector("button")!.click());
	assert.deepEqual(actions, ["refresh"]);
});

for (const cancelAtPeriodEnd of [false, true]) {
	test(`legacy card trial keeps ${cancelAtPeriodEnd ? "canceled" : "enabled"} renewal clear`, async () => {
		await mount(
			{
				...subscription,
				status: "trialing",
				cancelAtPeriodEnd,
				canCancel: !cancelAtPeriodEnd,
				canRestoreRenewal: cancelAtPeriodEnd,
				trial: { ...trial, mode: "card_required" },
			},
			"plus",
		);
		const card = container.querySelector(".billing-summary-card")!;
		assert.match(card.textContent!, /Free trial/);
		assert.match(
			card.textContent!,
			cancelAtPeriodEnd ? /No automatic charges/ : /Renewal is enabled/,
		);
		assert.doesNotMatch(card.textContent!, /Set up renewal/);
		await act(async () => card.querySelector("button")!.click());
		assert.equal(
			container.querySelector<HTMLDetailsElement>(
				".billing-summary-management",
			)!.open,
			true,
		);
		assert.equal((card as HTMLElement).hidden, true);
		assert.deepEqual(
			actions,
			[],
			"opening management is not consent to a payment",
		);
	});
}

test("another active plan remains authoritative when a different subscription needs payment", async () => {
	await mount(
		{
			...subscription,
			status: "past_due",
			trial: { ...trial, stage: "payment_required" },
		},
		"pro",
		{ other: { ...subscription, id: "subscription-b", planCode: "pro" } },
	);
	const card = container.querySelector(".billing-summary-card")!;
	assert.match(card.textContent!, /Current account access: Pro/);
	assert.doesNotMatch(card.textContent!, /Current account access: Free/);
	assert.equal(container.querySelectorAll(".billing-summary-card").length, 2);
});

for (const status of ["paused", "unrecognized"]) {
	test(`${status} never masquerades as a paid subscription`, async () => {
		await mount({ ...subscription, status, canCancel: false });
		const card = container.querySelector(".billing-summary-card")!;
		assert.doesNotMatch(
			card.textContent!,
			/Active subscription|Next payment|Renews automatically/,
		);
		await act(async () => card.querySelector("button")!.click());
		assert.deepEqual(actions, ["refresh"]);
	});
}

test("Free is neutral about trial eligibility and keeps the original destination", async () => {
	await mount(null);
	const card = container.querySelector(".billing-summary-card")!;
	assert.match(card.textContent!, /Join friends for free/);
	assert.equal(card.querySelector("a")!.getAttribute("href"), "/pricing");
	assert.doesNotMatch(card.textContent!, /Try.*free|3.day|trial.*available/);
});

for (const error of [undefined, "Please refresh to try again."]) {
	test(`${error ? "unavailable" : "loading"} state never implies Free or starts checkout`, async () => {
		await mount(null, "free", { empty: true, busy: !error, error });
		assert.ok(
			container.querySelector(error ? '[role="alert"]' : '[role="status"]'),
		);
		assert.doesNotMatch(
			container.textContent!,
			/Free subscription|View plans|Try.*free/,
		);
		assert.equal(container.querySelector('a[href="/pricing"]'), null);
		assert.deepEqual(actions, []);
	});
}

test("billing details retain plan, problem and actual account access", async () => {
	await mount({
		...subscription,
		status: "past_due",
		trial: { ...trial, stage: "payment_required" },
	});
	const buttons = [
		...container.querySelectorAll<HTMLButtonElement>(
			".billing-summary-card button",
		),
	];
	await act(async () =>
		buttons
			.find((b) => b.textContent?.includes("View billing details"))!
			.click(),
	);
	const details = container.querySelector<HTMLDetailsElement>(
		".billing-summary-management",
	)!;
	assert.equal(details.open, true);
	assert.match(
		details.textContent!,
		/Payment needs attention.*Plus subscription.*Current account access: Free/,
	);
	assert.match(details.textContent!, /Complete payment in Stripe/);
	assert.deepEqual(actions, []);
	await act(async () => {
		details.open = false;
		details.dispatchEvent(new Event("toggle"));
	});
	assert.equal(
		document.activeElement,
		buttons.find((b) => b.textContent?.includes("View billing details")),
	);
	assert.deepEqual(actions, [], "returning from details does not open Stripe");
});
