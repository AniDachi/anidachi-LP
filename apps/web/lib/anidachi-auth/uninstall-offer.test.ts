import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import type { AccountEntitlements } from "./account-entitlements";
import { getPricingOffer } from "./pricing-offer";
import {
	fulfillRetentionInvoice,
	type RetentionClaim,
} from "./retention-invoice";
import { retentionBillingSnapshot } from "./uninstall-billing";
import { uninstallCampaignConfig } from "./uninstall-config";
import { ensureUninstallPromotion, type UninstallBinding } from "./uninstall-promotion";
import {
	createUninstallService,
	type UninstallServiceDeps,
} from "./uninstall-service";
import {
	hasPositiveSubscriptionInvoice,
	UNINSTALL_FIRST_CAMPAIGN,
	UNINSTALL_RENEWAL_CAMPAIGN,
	type UninstallCatalog,
} from "./uninstall-stripe";

const userId = "11111111-1111-4111-8111-111111111111";
const at = Date.parse("2026-11-04T12:00:00Z");
function price(plan: string, amount: number) {
	return {
		id: "price_" + plan,
		active: true,
		livemode: false,
		currency: "usd",
		unit_amount: amount,
		type: "recurring",
		billing_scheme: "per_unit",
		transform_quantity: null,
		product: "prod_" + plan,
		recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
	} as Stripe.Price;
}
function coupon(campaign = UNINSTALL_FIRST_CAMPAIGN) {
	return {
		id: "coupon_" + campaign,
		valid: true,
		livemode: false,
		percent_off: 40,
		amount_off: null,
		duration: "once",
		redeem_by: null,
		max_redemptions: null,
		metadata: { anidachiCampaign: campaign },
		applies_to: { products: ["prod_plus", "prod_pro"] },
	} as unknown as Stripe.Coupon;
}
function customer() {
	return {
		id: "cus_owner",
		livemode: false,
		metadata: { userId },
		discount: null,
	} as unknown as Stripe.Customer;
}
function subscription() {
	return {
		id: "sub_owner",
		customer: "cus_owner",
		metadata: { userId },
		status: "active",
		livemode: false,
		discounts: [],
		items: {
			has_more: false,
			data: [
				{
					id: "si_owner",
					quantity: 1,
					price: price("plus", 799),
					discounts: [],
					current_period_start: at / 1000 - 100_000,
					current_period_end: at / 1000 + 100_000,
				},
			],
		},
	} as unknown as Stripe.Subscription;
}
function paidInvoice(total = 799) {
	return {
		id: "in_paid",
		customer: "cus_owner",
		livemode: false,
		status: "paid",
		total,
		parent: { subscription_details: { subscription: "sub_owner" } },
		lines: {
			has_more: false,
			data: [{ period: { start: at / 1000 - 100_000 } }],
		},
	} as unknown as Stripe.Invoice;
}
const list = <T>(data: T[]) => ({ data, has_more: false }) as Stripe.ApiList<T>;
function fixture() {
	const catalog: UninstallCatalog = {
		plus: price("plus", 799),
		pro: price("pro", 1499),
	};
	const s = subscription();
	const c = customer();
	let invoices: Stripe.Invoice[] = [];
	let codes: Stripe.PromotionCode[] = [];
	let subs: Stripe.Subscription[] = [];
	let clock = at;
	let claim: RetentionClaim | null = null;
	let checkoutCalls = 0;
	const account = {
		customerId: "cus_owner",
		customerIds: ["cus_owner"],
		subscriptionIds: ["sub_owner"],
		hasPaid: false,
		grant: undefined as "first" | "renewal" | undefined,
		firstBinding: null as UninstallBinding | null,
	};
	const config = {
		firstCoupon: coupon().id as string | null,
		renewalCoupon: coupon(UNINSTALL_RENEWAL_CAMPAIGN).id as string | null,
	};
	const stripe = {
		promotionCodes: { list: async () => list(codes) },
		customers: { retrieve: async () => c },
		subscriptions: { list: async () => list(subs), retrieve: async () => s },
		invoices: {
			list: async (p: Stripe.InvoiceListParams) =>
				list(
					p.status ? invoices.filter((i) => i.status === p.status) : invoices,
				),
		},
		coupons: {
			retrieve: async (id: string) =>
				id === coupon().id ? coupon() : coupon(UNINSTALL_RENEWAL_CAMPAIGN),
		},
	} as unknown as Stripe;
	const deps: UninstallServiceDeps = {
		stripe,
		secret: new TextEncoder().encode("test-review-secret"),
		now: () => clock,
		config: () => config,
		catalog: async () => catalog,
		purchaseOffer: async (owner) => ({
			ownerUserId: owner,
			action: "subscribe",
			validForMs: 60_000,
		}),
		account: async () => account,
		readClaim: async () => claim,
		reserve: async (terms) => {
			if (!claim) {
				claim = {
					...terms,
					id: "claim",
					state: "accepted",
					stripe_invoice_id: null,
					created_at: new Date(clock).toISOString(),
					reason: "Reserved.",
				};
				account.grant = "renewal";
			}
			return claim;
		},
		checkout: async (input) => {
			checkoutCalls++;
			assert.equal(input.displayedOffer?.trial, false);
			assert.equal(input.attribution.uninstallCouponId, coupon().id);
			return {
				kind: "checkout",
				url: "https://checkout.stripe.com/c/pay/test",
				planCode: input.planCode,
				trialOffered: false,
			};
		},
	};
	return {
		deps,
		service: createUninstallService(deps),
		account,
		config,
		catalog,
		c,
		s,
		paid() {
			subs = [s];
			invoices = [paidInvoice()];
		},
		setInvoices(value: Stripe.Invoice[]) {
			invoices = value;
		},
		reserveFirst() {
			account.grant = "first";
			account.firstBinding = {
				id: "binding", user_id: userId, stripe_customer_id: "cus_owner",
				coupon_id: coupon().id, created_at: new Date(at).toISOString(),
			};
			const code = {
				id: "promo_owner", customer: "cus_owner", coupon: coupon(),
				max_redemptions: 1, expires_at: null, times_redeemed: 0,
				active: true, livemode: false,
				restrictions: { first_time_transaction: false },
				metadata: { userId, campaignBindingId: "binding", anidachiCampaign: UNINSTALL_FIRST_CAMPAIGN },
			} as unknown as Stripe.PromotionCode;
			codes = [code];
			return code;
		},
		setSubs(value: Stripe.Subscription[]) {
			subs = value;
		},
		advance(ms: number) {
			clock += ms;
		},
		get claim() {
			return claim;
		},
		get checkoutCalls() {
			return checkoutCalls;
		},
	};
}
test("anonymous offer is ownerless and never reads Stripe/account data", async () => {
	const f = fixture();
	f.deps.account = async () => {
		throw Error("must not read");
	};
	assert.equal((await f.service.offer(null)).kind, "sign_in");
});

/** Exercise existing authoritative pricing policy, not a second trial policy. */
function purchaseAuthority(
	mode: "active_trial" | "pending_activation" | "free20" | "eligible_trial",
) {
	const time = new Date(at).toISOString();
	return (owner: string) =>
		getPricingOffer(owner, {
			priceId: (plan) => `price_${plan}`,
			readPrice: async (id, _active, billingPeriod = "monthly") => ({
				unitAmount: id === "price_plus" ? 799 : 1499,
				currency: "usd",
				billingPeriod,
			}),
			access: async () =>
				({
					policy: { planCode: mode === "active_trial" ? "plus" : "free" },
					history: { serverTime: time },
					hosting: {
						hostingActivationAt: time,
						hostingPolicyVersion: 1,
						trialEligibility: mode === "eligible_trial" ? "eligible" : "used",
					},
					selectedPlanExpiresAt:
						mode === "active_trial"
							? new Date(at + 3600_000).toISOString()
							: null,
				}) as AccountEntitlements,
			subscriptions: async () => [],
			pendingActivation: async () =>
				mode === "pending_activation"
					? { id: userId, planCode: "plus", billingPeriod: "monthly" }
					: null,
			policy: async () => ({
				activation_at: time,
				trials_enabled: mode === "eligible_trial",
				cardless_trials_enabled: true,
				free20_enabled: mode === "free20",
				revision: 1,
			}),
			now: () => at,
		});
}
for (const mode of ["active_trial", "pending_activation"] as const)
	test(`${mode} without Stripe subscription gets management and no Checkout/grant`, async () => {
		const f = fixture();
		const first = await f.service.offer(userId);
		assert.equal(first.kind, "first_month");
		if (first.kind !== "first_month")
			throw new Error("First-purchase fixture required.");
		f.deps.purchaseOffer = purchaseAuthority(mode);
		const result = await f.service.offer(userId);
		assert.equal(result.kind, "manage");
		if (result.kind === "manage")
			assert.equal(result.manageUrl, "/account/billing?manage=1");
		await assert.rejects(
			() =>
				f.service.checkout(
					userId,
					{
						expectedOwnerUserId: userId,
						revision: first.revision,
						planCode: "plus",
						expectedPrice: first.prices[0],
						requestId: userId,
					},
					"https://anidachi.test",
				),
			/no longer available/,
		);
		assert.equal(f.checkoutCalls, 0);
		assert.equal(f.account.grant, undefined);
		assert.equal(f.claim, null);
	});
for (const mode of ["free20", "eligible_trial"] as const)
	test(`${mode} ordinary free account remains eligible for direct first-month purchase`, async () => {
		const f = fixture();
		f.deps.purchaseOffer = purchaseAuthority(mode);
		const result = await f.service.offer(userId);
		assert.equal(result.kind, "first_month");
		if (result.kind !== "first_month")
			throw new Error("Expected first-month offer.");
		await f.service.checkout(
			userId,
			{
				expectedOwnerUserId: userId,
				revision: result.revision,
				planCode: "plus",
				expectedPrice: result.prices[0],
				requestId: userId,
			},
			"https://anidachi.test",
		);
		assert.equal(f.checkoutCalls, 1); // Existing fixture also asserts displayed trial=false.
	});
test("unknown, stale or foreign purchase authority fails unavailable before Checkout", async () => {
	const f = fixture();
	const first = await f.service.offer(userId);
	assert.equal(first.kind, "first_month");
	if (first.kind !== "first_month") throw new Error("Expected fixture.");
	for (const read of [
		async () => {
			throw new Error("Authority unavailable");
		},
		async () => ({
			ownerUserId: userId,
			action: "sign_in" as const,
			validForMs: 60_000,
		}),
		async () => ({
			ownerUserId: userId,
			action: "subscribe" as const,
			validForMs: 0,
		}),
		async () => ({
			ownerUserId: "foreign",
			action: "subscribe" as const,
			validForMs: 60_000,
		}),
	]) {
		f.deps.purchaseOffer = read;
		assert.equal((await f.service.offer(userId)).kind, "unavailable");
		await assert.rejects(() =>
			f.service.checkout(
				userId,
				{
					expectedOwnerUserId: userId,
					revision: first.revision,
					planCode: "plus",
					expectedPrice: first.prices[0],
					requestId: userId,
				},
				"https://anidachi.test",
			),
		);
	}
	assert.equal(f.checkoutCalls, 0);
	assert.equal(f.account.grant, undefined);
});
test("never paid account sees verified two monthly prices, integer 40% discount and no trial", async () => {
	const f = fixture();
	const offer = await f.service.offer(userId);
	assert.equal(offer.kind, "first_month");
	if (offer.kind !== "first_month") return;
	assert.deepEqual(
		offer.prices.map((p) => [p.ordinaryAmount, p.discountedAmount]),
		[
			[799, 479],
			[1499, 899],
		],
	);
	assert.ok(!JSON.stringify(offer).includes("coupon_"));
	await f.service.checkout(
		userId,
		{
			expectedOwnerUserId: userId,
			revision: offer.revision,
			planCode: "plus",
			expectedPrice: offer.prices[0],
			requestId: userId,
		},
		"https://anidachi.test",
	);
	assert.equal(f.checkoutCalls, 1);
});
test("checkout rejects wrong owner, changed amount and expired revision before side effects", async () => {
	const f = fixture();
	const offer = await f.service.offer(userId);
	assert.equal(offer.kind, "first_month");
	if (offer.kind !== "first_month") return;
	const input = {
		expectedOwnerUserId: userId,
		revision: offer.revision,
		planCode: "plus" as const,
		expectedPrice: offer.prices[0],
		requestId: userId,
	};
	await assert.rejects(
		() => f.service.checkout("other", input, "https://anidachi.test"),
		/account changed/,
	);
	await assert.rejects(
		() =>
			f.service.checkout(
				userId,
				{
					...input,
					expectedPrice: { ...input.expectedPrice, discountedAmount: 1 },
				},
				"https://anidachi.test",
			),
		/price changed/,
	);
	f.advance(60_001);
	await assert.rejects(
		() => f.service.checkout(userId, input, "https://anidachi.test"),
		/expired/,
	);
	assert.equal(f.checkoutCalls, 0);
});
test("ordinary paid/refunded/credit history does not consume the uninstall discount", async () => {
	for (const invoice of [
		paidInvoice(),
		{ ...paidInvoice(), amount_paid: 0 },
		{ ...paidInvoice(), post_payment_credit_notes_amount: 799 },
	])
		assert.equal(
			hasPositiveSubscriptionInvoice(list([invoice]), "cus_owner"),
			true,
		);
	const f = fixture();
	f.setInvoices([paidInvoice(0)]);
	assert.equal((await f.service.offer(userId)).kind, "first_month");
	f.setInvoices([paidInvoice()]);
	assert.equal((await f.service.offer(userId)).kind, "first_month");
});
for (const history of ["database", "stripe", "both"] as const)
	test(`former subscriber with ${history} paid history can buy a discounted new month`, async () => {
		const f = fixture();
		f.account.hasPaid = history !== "stripe";
		if (history !== "database") f.setInvoices([paidInvoice()]);
		f.s.status = "canceled";
		f.setSubs([f.s]);
		const offer = await f.service.offer(userId);
		assert.equal(offer.kind, "first_month");
		if (offer.kind !== "first_month") throw Error("Missing returning offer");
		for (const price of offer.prices) await f.service.checkout(userId, {
			expectedOwnerUserId: userId, revision: offer.revision,
			planCode: price.planCode, expectedPrice: price, requestId: userId,
		}, "https://anidachi.test");
		assert.equal(f.checkoutCalls, 2);
	});
test("unused first-month reservation survives ordinary paid history; redemption prevents another offer and checkout", async () => {
	const f = fixture();
	f.account.hasPaid = true; f.setInvoices([paidInvoice()]);
	const code = f.reserveFirst();
	const offer = await f.service.offer(userId);
	assert.equal(offer.kind, "first_month");
	if (offer.kind !== "first_month") throw Error("Missing reserved offer");
	code.times_redeemed = 1; code.active = false;
	const used = await f.service.offer(userId);
	assert.equal(used.kind, "disabled");
	assert.match("reason" in used ? used.reason : "", /already been used/);
	await assert.rejects(() => f.service.checkout(userId, {
		expectedOwnerUserId: userId, revision: offer.revision,
		planCode: "plus", expectedPrice: offer.prices[0], requestId: userId,
	}, "https://anidachi.test"));
	assert.equal(f.checkoutCalls, 0);
});
test("reserved renewal cannot become a new purchase after the subscription ends", async () => {
	const f = fixture(); f.account.hasPaid = true; f.account.grant = "renewal";
	assert.equal((await f.service.offer(userId)).kind, "disabled");
});
test("inactive, foreign, changed and missing first promotions never expose a fresh allowance", async () => {
	const f = fixture(); const code = f.reserveFirst();
	code.active = false;
	assert.equal((await f.service.offer(userId)).kind, "disabled");
	code.active = true; code.metadata!.userId = "foreign";
	assert.equal((await f.service.offer(userId)).kind, "unavailable");
	code.metadata!.userId = userId; code.max_redemptions = 2;
	assert.equal((await f.service.offer(userId)).kind, "unavailable");
	code.max_redemptions = 1; f.account.firstBinding!.coupon_id = "changed";
	assert.equal((await f.service.offer(userId)).kind, "unavailable");
	f.account.firstBinding = null;
	assert.equal((await f.service.offer(userId)).kind, "unavailable");
});
test("monthly active paid account reserves exact next renewal; repeats and reload restore accepted state after expiry/disable", async () => {
	const f = fixture();
	f.paid();
	const offer = await f.service.offer(userId);
	assert.equal(offer.kind, "renewal");
	if (offer.kind !== "renewal") return;
	const input = { expectedOwnerUserId: userId, revision: offer.revision };
	const [a, b] = await Promise.all([
		f.service.claim(userId, input),
		f.service.claim(userId, input),
	]);
	assert.equal(a.kind, "claimed");
	assert.deepEqual(a, b);
	assert.equal(
		f.claim?.target_period_start,
		f.s.items.data[0].current_period_end,
	);
	f.advance(70_000);
	f.config.renewalCoupon = null;
	f.config.firstCoupon = null;
	assert.equal((await f.service.claim(userId, input)).kind, "claimed");
	assert.equal((await f.service.offer(userId)).kind, "claimed");
	await assert.rejects(
		() => f.service.claim(userId, { ...input, revision: "other" }),
		/already has/,
	);
});

async function acceptedFixture() {
	const f = fixture();
	f.paid();
	const offer = await f.service.offer(userId);
	assert.equal(offer.kind, "renewal");
	if (offer.kind !== "renewal") throw new Error("Expected renewal fixture.");
	const input = { expectedOwnerUserId: userId, revision: offer.revision };
	await f.service.claim(userId, input);
	return { ...f, claimInput: input };
}
for (const [label, mutate] of [
	[
		"cancellation",
		(s: Stripe.Subscription) => {
			s.cancel_at_period_end = true;
		},
	],
	[
		"annual change",
		(s: Stripe.Subscription) => {
			assert.ok(s.items.data[0].price.recurring);
			s.items.data[0].price.recurring.interval = "year";
		},
	],
	[
		"price change",
		(s: Stripe.Subscription) => {
			s.items.data[0].price.id = "price_new";
		},
	],
	[
		"amount change",
		(s: Stripe.Subscription) => {
			s.items.data[0].price.unit_amount = 999;
		},
	],
	[
		"period change",
		(s: Stripe.Subscription) => {
			s.items.data[0].current_period_end += 1000;
		},
	],
] as const)
	test(`restored accepted claim after ${label} does not promise a discounted renewal`, async () => {
		const f = await acceptedFixture();
		mutate(f.s);
		for (const result of [
			await f.service.offer(userId),
			await f.service.claim(userId, f.claimInput),
		]) {
			assert.equal(result.kind, "claimed");
			if (result.kind === "claimed") assert.equal(result.state, "ineligible");
		}
		assert.equal(
			f.claim?.state,
			"accepted",
			"presentation must not revoke the durable obligation",
		);
		assert.equal(f.account.grant, "renewal");
	});
test("restored claim at target time shows reconciliation immediately, not a future discount", async () => {
	const f = await acceptedFixture();
	f.advance(99_990_000);
	const before = await f.service.offer(userId);
	assert.equal(
		before.validForMs,
		10_000,
		"display lease cannot outlive the reserved renewal boundary",
	);
	f.advance(10_000);
	for (const result of [
		await f.service.offer(userId),
		await f.service.claim(userId, f.claimInput),
	]) {
		assert.equal(result.kind, "claimed");
		if (result.kind === "claimed") assert.equal(result.state, "reconciliation");
	}
	assert.equal(f.claim?.state, "accepted");
});
test("transient Stripe read failure does not restore accepted presentation or alter the promise", async () => {
	const f = await acceptedFixture();
	f.deps.stripe.subscriptions.retrieve = async () => {
		throw new Error("transient Stripe failure");
	};
	for (const result of [
		await f.service.offer(userId),
		await f.service.claim(userId, f.claimInput),
	]) {
		assert.equal(result.kind, "claimed");
		if (result.kind === "claimed") assert.equal(result.state, "reconciliation");
	}
	assert.equal(f.claim?.state, "accepted");
});
test("valid reserved renewal restores with gates off and no current catalog dependency", async () => {
	const f = await acceptedFixture();
	f.config.firstCoupon = null;
	f.config.renewalCoupon = null;
	f.deps.config = () => {
		throw new Error("must not inspect issuance gates");
	};
	f.deps.catalog = async () => {
		throw new Error("must use frozen terms");
	};
	for (const result of [
		await f.service.offer(userId),
		await f.service.claim(userId, f.claimInput),
	]) {
		assert.equal(result.kind, "claimed");
		if (result.kind === "claimed") assert.equal(result.state, "accepted");
	}
});
test("applied renewal remains historical applied after subscription cancellation and Stripe outage", async () => {
	const f = await acceptedFixture();
	assert.ok(f.claim);
	f.claim.state = "applied";
	f.claim.stripe_invoice_id = "in_paid";
	f.s.cancel_at_period_end = true;
	f.deps.stripe.subscriptions.retrieve = async () => {
		throw new Error("must not reinterpret historical applied invoice");
	};
	f.advance(100_000_001);
	const result = await f.service.offer(userId);
	assert.equal(result.kind, "claimed");
	if (result.kind === "claimed") assert.equal(result.state, "applied");
});
for (const [label, change] of [
	[
		"yearly",
		(s: Stripe.Subscription) => {
			assert.ok(s.items.data[0].price.recurring);
			s.items.data[0].price.recurring.interval = "year";
		},
	],
	[
		"past due",
		(s: Stripe.Subscription) => {
			s.status = "past_due";
		},
	],
	[
		"trial",
		(s: Stripe.Subscription) => {
			s.status = "trialing";
		},
	],
	[
		"canceled renewal",
		(s: Stripe.Subscription) => {
			s.cancel_at_period_end = true;
		},
	],
	[
		"scheduled",
		(s: Stripe.Subscription) => {
			s.schedule = "sched";
		},
	],
	[
		"pending update",
		(s: Stripe.Subscription) => {
			s.pending_update = {} as Stripe.Subscription.PendingUpdate;
		},
	],
	[
		"discounted",
		(s: Stripe.Subscription) => {
			s.discounts = ["di_other"];
		},
	],
	[
		"near boundary",
		(s: Stripe.Subscription) => {
			s.items.data[0].current_period_end = at / 1000 + 100;
		},
	],
] as const)
	test(`${label} cannot receive renewal offer`, async () => {
		const f = fixture();
		f.paid();
		change(f.s);
		assert.equal((await f.service.offer(userId)).kind, "manage");
	});
test("lifetime shared first grant prevents a renewal even when first checkout outcome is uncertain", async () => {
	const f = fixture();
	f.paid();
	f.account.grant = "first";
	assert.equal((await f.service.offer(userId)).kind, "manage");
});

for (const [status, expected] of [
	["past_due", /payment is overdue.*Update your payment details/],
	["unpaid", /payment is overdue.*Update your payment details/],
	["incomplete", /payment is incomplete.*finish it/],
	["paused", /billing is paused.*Review it/],
	["trialing", /no paid renewal.*Check your subscription details/],
] as const) test(`${status} explains the billing restriction without offering checkout`, async () => {
	const f = fixture(); f.paid(); f.s.status = status;
	const offer = await f.service.offer(userId);
	assert.equal(offer.kind, "manage");
	assert.match("reason" in offer ? offer.reason : "", expected);
	assert.equal(f.checkoutCalls, 0);
});
test("multiple/foreign subscriptions and missing catalog fail closed", async () => {
	const f = fixture();
	f.setSubs([f.s, { ...f.s, id: "sub_two" }]);
	assert.equal((await f.service.offer(userId)).kind, "unavailable");
	f.setSubs([{ ...f.s, metadata: { userId: "foreign" } }]);
	assert.equal((await f.service.offer(userId)).kind, "unavailable");
	f.deps.catalog = async () => {
		throw Error("missing catalog");
	};
	assert.equal((await f.service.offer(userId)).kind, "unavailable");
});
test("target invoice already issued refuses claim; price/period change invalidates reviewed revision", async () => {
	const f = fixture();
	f.paid();
	const offer = await f.service.offer(userId);
	assert.equal(offer.kind, "renewal");
	if (offer.kind !== "renewal") return;
	f.s.items.data[0].current_period_end += 100;
	await assert.rejects(
		() =>
			f.service.claim(userId, {
				expectedOwnerUserId: userId,
				revision: offer.revision,
			}),
		/changed|expired/,
	);
	const issued = paidInvoice();
	issued.status = "draft";
	issued.lines.data[0].period.start = f.s.items.data[0].current_period_end;
	f.setInvoices([paidInvoice(), issued]);
	assert.equal((await f.service.offer(userId)).kind, "manage");
});

function invoiceFixture() {
	const s = subscription();
	const target = s.items.data[0].current_period_end;
	s.items.data[0].current_period_start = target;
	s.items.data[0].current_period_end += 2_592_000;
	const c: RetentionClaim = {
		id: "claim",
		user_id: userId,
		stripe_customer_id: "cus_owner",
		stripe_subscription_id: "sub_owner",
		coupon_id: coupon(UNINSTALL_RENEWAL_CAMPAIGN).id,
		product_ids: ["prod_plus", "prod_pro"],
		price_id: "price_plus",
		plan_code: "plus",
		unit_amount: 799,
		target_period_start: target,
		review_revision: "review",
		state: "accepted",
		stripe_invoice_id: null,
		reason: "Reserved.",
		created_at: new Date(at).toISOString(),
	};
	const invoice = {
		id: "in_target",
		customer: "cus_owner",
		livemode: false,
		status: "draft",
		currency: "usd",
		billing_reason: "subscription_cycle",
		metadata: {},
		discounts: [],
		total_discount_amounts: [],
		parent: { subscription_details: { subscription: "sub_owner" } },
		lines: {
			has_more: false,
			data: [
				{
					amount: 799,
					quantity: 1,
					discountable: true,
					discounts: [],
					discount_amounts: [],
					parent: {
						type: "subscription_item_details",
						subscription_item_details: {
							subscription: "sub_owner",
							proration: false,
						},
					},
					pricing: { price_details: { price: "price_plus" } },
					period: { start: target, end: target + 2_592_000 },
				},
			],
		},
	} as unknown as Stripe.Invoice;
	let writes = 0;
	let lostReply = false;
	let failedFinish = false;
	let failedBind = false;
	let dropWrite = false;
	const stripe = {
		invoices: {
			retrieve: async () => structuredClone(invoice),
			update: async (
				_id: string,
				params: Stripe.InvoiceUpdateParams,
				opts: Stripe.RequestOptions,
			) => {
				assert.equal(
					c.stripe_invoice_id,
					invoice.id,
					"invoice binding must precede write",
				);
				writes++;
				assert.equal(
					opts.idempotencyKey,
					"uninstall-renewal-invoice:claim:in_target",
				);
				if (dropWrite) throw Error("network");
				const d = {
					id: "di_offer",
					customer: "cus_owner",
					coupon: coupon(UNINSTALL_RENEWAL_CAMPAIGN),
					invoice: invoice.id,
					subscription: null,
				} as Stripe.Discount;
				invoice.discounts = [d];
				invoice.total_discount_amounts = [{ discount: d.id, amount: 320 }];
				invoice.metadata = params.metadata as Stripe.Metadata;
				if (lostReply) throw Error("response lost after commit");
				return invoice;
			},
		},
		subscriptions: { retrieve: async () => s },
		customers: { retrieve: async () => customer() },
		coupons: { retrieve: async () => coupon(UNINSTALL_RENEWAL_CAMPAIGN) },
	} as unknown as Stripe;
	const deps = {
		stripe,
		find: async () => c,
		bind: async (_claim: string, id: string) => {
			if (failedBind) throw Error("DB bind failed");
			c.stripe_invoice_id = id;
			return c;
		},
		finish: async (
			_claim: string,
			_invoice: string | null,
			state: RetentionClaim["state"],
			reason: string,
		) => {
			if (failedFinish) throw Error("DB finish failed");
			c.state = state;
			c.reason = reason;
		},
	};
	return {
		s,
		c,
		invoice,
		deps,
		get writes() {
			return writes;
		},
		lost() {
			lostReply = true;
		},
		failFinish(v: boolean) {
			failedFinish = v;
		},
		failBind() {
			failedBind = true;
		},
		failWrite() {
			dropWrite = true;
		},
	};
}
test("renewal invoice receives one isolated coupon; duplicate event no write; next period no discount", async () => {
	const f = invoiceFixture();
	const event = structuredClone(f.invoice);
	await fulfillRetentionInvoice(event, f.deps);
	assert.equal(f.c.state, "applied");
	assert.equal(f.writes, 1);
	await fulfillRetentionInvoice(event, f.deps);
	assert.equal(f.writes, 1);
	event.id = "in_next";
	event.lines.data[0].period.start += 2_592_000;
	await fulfillRetentionInvoice(event, f.deps);
	assert.equal(f.writes, 1);
	assert.equal(retentionBillingSnapshot(f.s, f.c, at), undefined);
});
test("Stripe lost reply and DB failure after commit reconcile same invoice without second write", async () => {
	const f = invoiceFixture();
	f.lost();
	f.failFinish(true);
	await assert.rejects(
		() => fulfillRetentionInvoice(structuredClone(f.invoice), f.deps),
		/DB finish/,
	);
	assert.equal(f.writes, 1);
	f.failFinish(false);
	await fulfillRetentionInvoice(structuredClone(f.invoice), f.deps);
	assert.equal(f.c.state, "applied");
	assert.equal(f.writes, 1);
});
test("DB bind failure causes no Stripe mutation; network failure is retryable", async () => {
	const f = invoiceFixture();
	f.failBind();
	await assert.rejects(
		() => fulfillRetentionInvoice(f.invoice, f.deps),
		/DB bind/,
	);
	assert.equal(f.writes, 0);
	const g = invoiceFixture();
	g.failWrite();
	await assert.rejects(
		() => fulfillRetentionInvoice(g.invoice, g.deps),
		/not confirmed/,
	);
	assert.equal(g.c.state, "accepted");
});
test("finalized invoice without confirmed discount persists explicit reconciliation failure", async () => {
	const f = invoiceFixture();
	f.invoice.status = "open";
	await assert.rejects(
		() => fulfillRetentionInvoice(f.invoice, f.deps),
		/finalized/,
	);
	assert.equal(f.writes, 0);
	assert.equal(f.c.state, "reconciliation");
});
for (const [label, mutate] of [
	[
		"manual",
		(f: ReturnType<typeof invoiceFixture>) => {
			f.invoice.billing_reason = "manual";
		},
	],
	[
		"wrong period",
		(f: ReturnType<typeof invoiceFixture>) => {
			f.invoice.lines.data[0].period.start++;
		},
	],
	[
		"proration",
		(f: ReturnType<typeof invoiceFixture>) => {
			const details = f.invoice.lines.data[0].parent?.subscription_item_details;
			assert.ok(details);
			details.proration = true;
		},
	],
	[
		"annual",
		(f: ReturnType<typeof invoiceFixture>) => {
			assert.ok(f.s.items.data[0].price.recurring);
			f.s.items.data[0].price.recurring.interval = "year";
		},
	],
	[
		"cancellation",
		(f: ReturnType<typeof invoiceFixture>) => {
			f.s.cancel_at_period_end = true;
		},
	],
	[
		"pending change",
		(f: ReturnType<typeof invoiceFixture>) => {
			f.s.schedule = "sched";
		},
	],
	[
		"another discount",
		(f: ReturnType<typeof invoiceFixture>) => {
			f.invoice.discounts = ["di_other"];
		},
	],
] as const)
	test(`${label} invoice is never discounted`, async () => {
		const f = invoiceFixture();
		mutate(f);
		await fulfillRetentionInvoice(f.invoice, f.deps);
		assert.equal(f.writes, 0);
	});
test("pending billing snapshot discounts only the reserved next month", () => {
	const f = invoiceFixture();
	f.s.items.data[0].current_period_end = f.c.target_period_start;
	assert.equal(
		retentionBillingSnapshot(f.s, f.c, at)?.nextPrice?.unitAmount,
		479,
	);
	f.s.cancel_at_period_end = true;
	assert.equal(retentionBillingSnapshot(f.s, f.c, at), undefined);
});
for (const [label, mutate] of [
	[
		"pending invoice items",
		(s: Stripe.Subscription) => {
			s.pending_invoice_item_interval = {
				interval: "month",
				interval_count: 1,
			};
		},
	],
	[
		"subscription billing threshold",
		(s: Stripe.Subscription) => {
			s.billing_thresholds = {
				amount_gte: 1000,
				reset_billing_cycle_anchor: false,
			};
		},
	],
	[
		"item billing threshold",
		(s: Stripe.Subscription) => {
			s.items.data[0].billing_thresholds = { usage_gte: 100 };
		},
	],
] as const)
	test(`pending billing discount disappears after ${label} change`, () => {
		const f = invoiceFixture();
		f.s.items.data[0].current_period_end = f.c.target_period_start;
		assert.equal(
			retentionBillingSnapshot(f.s, f.c, at)?.nextPrice?.unitAmount,
			479,
		);
		mutate(f.s);
		assert.equal(retentionBillingSnapshot(f.s, f.c, at), undefined);
		assert.equal(
			f.c.state,
			"accepted",
			"display exclusion does not release the durable promise",
		);
	});
for (const hasPaid of [false, true]) test(`new-subscription promotion stays account-bound and single-use (previously paid: ${hasPaid})`, async () => {
	const catalog = { plus: price("plus", 799), pro: price("pro", 1499) };
	let codes: Stripe.PromotionCode[] = [];
	let writes = 0;
	const binding = {
		id: "binding",
		user_id: userId,
		stripe_customer_id: "cus_owner",
		coupon_id: coupon().id,
		created_at: new Date(at).toISOString(),
	};
	const stripe = {
		coupons: { retrieve: async () => coupon() },
		customers: { retrieve: async () => customer() },
		invoices: { list: async () => list(hasPaid ? [paidInvoice()] : []) },
		promotionCodes: {
			list: async () => list(codes),
			create: async (
				params: Stripe.PromotionCodeCreateParams,
				options: Stripe.RequestOptions,
			) => {
				writes++;
				assert.equal(options.idempotencyKey, "uninstall-first-promo:binding");
				assert.equal(params.code, undefined);
				const code = {
					...params,
					id: "promo_owner",
					coupon: coupon(),
					active: true,
					livemode: false,
					expires_at: null,
					times_redeemed: 0,
					restrictions: { first_time_transaction: false },
				} as unknown as Stripe.PromotionCode;
				codes = [code];
				return code;
			},
		},
	} as unknown as Stripe;
	const deps = {
		stripe,
		catalog,
		now: () => at,
		accountHistory: async () => ({
			customerIds: ["cus_owner"],
			hasPaid,
		}),
		claim: async () => binding,
	};
	const input = { userId, customerId: "cus_owner", couponId: coupon().id };
	assert.equal(await ensureUninstallPromotion(input, deps), "promo_owner");
	assert.equal(await ensureUninstallPromotion(input, deps), "promo_owner");
	assert.equal(writes, 1);
	codes[0].times_redeemed = 1;
	await assert.rejects(
		() => ensureUninstallPromotion(input, deps),
		/unavailable/,
	);
	codes = [];
	binding.created_at = new Date(at - 24 * 3600_000).toISOString();
	await assert.rejects(
		() => ensureUninstallPromotion(input, deps),
		/reconciliation/,
	);
	assert.equal(writes, 1);
});
test("campaign config ignores unsuffixed and LIVE values and never enables production", () => {
	const keys = [
		"VERCEL_ENV",
		"STRIPE_UNINSTALL_FIRST_ENABLED_TEST",
		"STRIPE_UNINSTALL_FIRST_COUPON_ID_TEST",
		"STRIPE_UNINSTALL_FIRST_COUPON_ID",
	];
	const old = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
	try {
		process.env.VERCEL_ENV = "preview";
		delete process.env.STRIPE_UNINSTALL_FIRST_COUPON_ID_TEST;
		process.env.STRIPE_UNINSTALL_FIRST_ENABLED_TEST = "true";
		process.env.STRIPE_UNINSTALL_FIRST_COUPON_ID = "must_not_use";
		assert.equal(uninstallCampaignConfig().firstCoupon, null);
		process.env.STRIPE_UNINSTALL_FIRST_COUPON_ID_TEST = "test";
		assert.equal(uninstallCampaignConfig().firstCoupon, "test");
		process.env.VERCEL_ENV = "production";
		assert.equal(uninstallCampaignConfig().firstCoupon, null);
	} finally {
		for (const k of keys)
			if (old[k] === undefined) delete process.env[k];
			else process.env[k] = old[k];
	}
});
