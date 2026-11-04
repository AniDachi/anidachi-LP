// Sandbox-only proof using the actual offer functions and the CLI-owned credential.
// Prepare -> register synthetic users/customer mappings -> exercise. No real login.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type Stripe from "stripe";
import {
	fulfillRetentionInvoice,
	type RetentionClaim,
} from "../../lib/anidachi-auth/retention-invoice";
import { ensureUninstallPromotion } from "../../lib/anidachi-auth/uninstall-promotion";
import {
	UNINSTALL_FIRST_CAMPAIGN,
	UNINSTALL_RENEWAL_CAMPAIGN,
	verifyUninstallCatalog,
	verifyUninstallCoupon,
} from "../../lib/anidachi-auth/uninstall-stripe";
import { createTestCliStripeClient } from "./stripe-test-cli-transport";

const accountId = "acct_1RlmiIPQIEOqG7pr";
const firstCoupon = "anidachi_uninstall_first40_2026_test";
const renewalCoupon = "anidachi_uninstall_renewal40_2026_test";
const priceIds = [
	"price_1TkktLPQIEOqG7prWLOncTeX",
	"price_1Tkku6PQIEOqG7prqtCEYYEq",
];
type Fixture = {
	label: string;
	userId: string;
	customerId: string;
	plan: "plus" | "pro";
	bindingId: string;
	createdAt: string;
	subscriptionId?: string;
	promotionId?: string;
	checkoutId?: string;
	claim?: RetentionClaim;
};
type Proof = {
	run: string;
	clock: string;
	extraClock?: string;
	clockTime: number;
	phase: string;
	fixtures: Fixture[];
	checks: Array<Record<string, unknown>>;
};

function required<T>(value: T | null | undefined): T {
	assert.ok(
		value !== null && value !== undefined,
		"Required fixture value missing",
	);
	return value;
}

async function main() {
	const mode = process.argv[2];
	const file = process.argv[3];
	assert.ok(
		["prepare", "exercise"].includes(mode),
		"Choose prepare or exercise",
	);
	assert.ok(
		file?.startsWith("/") && file.endsWith(".json"),
		"Absolute proof receipt path required",
	);
	const stripe = createTestCliStripeClient("anidachi-cardless-proof");
	assert.equal((await stripe.accounts.retrieve()).id, accountId);
	const prices = await Promise.all(
		priceIds.map((id) => stripe.prices.retrieve(id)),
	);
	const catalog = verifyUninstallCatalog(prices, priceIds);
	for (const [id, campaign] of [
		[firstCoupon, UNINSTALL_FIRST_CAMPAIGN],
		[renewalCoupon, UNINSTALL_RENEWAL_CAMPAIGN],
	]) {
		verifyUninstallCoupon(
			await stripe.coupons.retrieve(id, { expand: ["applies_to"] }),
			id,
			campaign,
			catalog,
		);
	}
	let proof: Proof;
	const save = () => writeFileSync(file, `${JSON.stringify(proof, null, 2)}\n`);
	const record = (check: string, detail: Record<string, unknown>) => {
		proof.checks.push({ check, ...detail });
		save();
		console.log(JSON.stringify({ check, ...detail }));
	};
	if (mode === "prepare") {
		if (existsSync(file)) {
			proof = JSON.parse(readFileSync(file, "utf8"));
			assert.equal(
				proof.phase,
				"preparing",
				"Only interrupted preparation can resume",
			);
		} else {
			const run = randomUUID();
			const clock = await stripe.testHelpers.testClocks.create({
				frozen_time: Math.floor(Date.now() / 1000),
				name: `Uninstall offers ${run.slice(0, 8)}`,
			});
			assert.equal(clock.livemode, false);
			proof = {
				run,
				clock: clock.id,
				clockTime: clock.frozen_time,
				phase: "preparing",
				fixtures: [],
				checks: [],
			};
			save();
		}
		if (!proof.extraClock) {
			const extra = await stripe.testHelpers.testClocks.create(
				{
					frozen_time: proof.clockTime,
					name: `Uninstall offers B ${proof.run.slice(0, 8)}`,
				},
				{ idempotencyKey: `${proof.run}-clock-b` },
			);
			assert.equal(extra.livemode, false);
			proof.extraClock = extra.id;
			save();
		}
		const labels = [
			"first-plus",
			"first-pro",
			"renewal-plus",
			"renewal-pro",
			"annual-guard",
		];
		for (const [index, label] of labels.entries()) {
			const known = proof.fixtures.find((f) => f.label === label);
			if (known) {
				const customer = await stripe.customers.retrieve(known.customerId);
				assert.ok(
					!customer.deleted &&
						!customer.livemode &&
						customer.metadata.proofRun === proof.run &&
						customer.metadata.userId === known.userId,
				);
				assert.ok(
					customer.invoice_settings.default_payment_method,
					"Interrupted payment setup needs explicit reconciliation",
				);
				continue;
			}
			const userId = randomUUID();
			const customer: Stripe.Customer = await stripe.customers.create({
				name: `Uninstall Sandbox proof ${label}`,
				test_clock: index < 3 ? proof.clock : proof.extraClock,
				metadata: {
					anidachiProof: "uninstall_2026",
					proofRun: proof.run,
					userId,
				},
			});
			assert.equal(customer.livemode, false);
			const fixture: Fixture = {
				label,
				userId,
				customerId: customer.id,
				plan: label.endsWith("pro") ? "pro" : "plus",
				bindingId: randomUUID(),
				createdAt: new Date().toISOString(),
			};
			proof.fixtures.push(fixture);
			save();
			const pm = await stripe.paymentMethods.attach("pm_card_visa", {
				customer: customer.id,
			});
			await stripe.customers.update(customer.id, {
				invoice_settings: { default_payment_method: pm.id },
			});
		}
		proof.phase = "prepared";
		save();
		console.log(
			JSON.stringify({
				phase: proof.phase,
				receipt: file,
				customers: proof.fixtures.map((f) => ({
					id: f.customerId,
					userId: f.userId,
					label: f.label,
				})),
			}),
		);
		return;
	}
	proof = JSON.parse(readFileSync(file, "utf8"));
	assert.equal(
		proof.phase,
		"prepared",
		"Do not replay mutations against a partially exercised receipt",
	);
	assert.equal(proof.fixtures.length, 5);
	const clock = await stripe.testHelpers.testClocks.retrieve(proof.clock);
	assert.equal(clock.livemode, false);
	assert.equal(clock.frozen_time, proof.clockTime);
	proof.phase = "exercising";
	save();
	async function provision(f: Fixture) {
		return ensureUninstallPromotion(
			{ userId: f.userId, customerId: f.customerId, couponId: firstCoupon },
			{
				stripe,
				catalog,
				accountHistory: async () => ({
					customerIds: [f.customerId],
					hasPaid: false,
				}),
				claim: async () => ({
					id: f.bindingId,
					user_id: f.userId,
					stripe_customer_id: f.customerId,
					coupon_id: firstCoupon,
					created_at: f.createdAt,
				}),
			},
		);
	}
	const meta = (f: Fixture) => ({
		anidachiProof: "uninstall_2026",
		proofRun: proof.run,
		userId: f.userId,
	});
	for (const f of proof.fixtures) {
		// Strict fixture identity before every financial test write.
		const c = await stripe.customers.retrieve(f.customerId);
		assert.ok(
			!c.deleted &&
				!c.livemode &&
				c.metadata.proofRun === proof.run &&
				c.metadata.userId === f.userId,
		);
		if (f.label.startsWith("first-")) {
			f.promotionId = await provision(f);
			save();
			assert.equal(await provision(f), f.promotionId);
			const checkout = await stripe.checkout.sessions.create({
				mode: "subscription",
				customer: f.customerId,
				line_items: [{ price: catalog[f.plan].id, quantity: 1 }],
				discounts: [{ promotion_code: f.promotionId }],
				success_url:
					"https://staging.anidachi.app/success?session_id={CHECKOUT_SESSION_ID}",
				cancel_url: "https://staging.anidachi.app/uninstall",
				client_reference_id: f.userId,
				metadata: meta(f),
				subscription_data: { metadata: meta(f) },
			});
			f.checkoutId = checkout.id;
			save();
			assert.equal(checkout.livemode, false);
			assert.equal(checkout.amount_total, f.plan === "plus" ? 479 : 899);
			assert.ok(!checkout.allow_promotion_codes);
			await stripe.checkout.sessions.expire(checkout.id);
			assert.equal(
				await provision(f),
				f.promotionId,
				"Abandonment reuses the same promo",
			);
		}
		const sub = await stripe.subscriptions.create({
			customer: f.customerId,
			items: [{ price: catalog[f.plan].id }],
			metadata: meta(f),
			...(f.promotionId
				? { discounts: [{ promotion_code: f.promotionId }] }
				: {}),
		});
		f.subscriptionId = sub.id;
		save();
		assert.equal(sub.status, "active");
		assert.equal(sub.livemode, false);
		const invoice = await stripe.invoices.retrieve(
			sub.latest_invoice as string,
		);
		assert.equal(invoice.status, "paid");
		const amount = f.plan === "plus" ? 799 : 1499;
		assert.equal(
			invoice.amount_paid,
			f.promotionId ? (f.plan === "plus" ? 479 : 899) : amount,
		);
		if (f.promotionId)
			await assert.rejects(provision(f), /no longer available/);
		if (f.label.startsWith("renewal-")) {
			f.claim = {
				id: randomUUID(),
				user_id: f.userId,
				stripe_customer_id: f.customerId,
				stripe_subscription_id: sub.id,
				coupon_id: renewalCoupon,
				product_ids: prices.map((p) => p.product as string),
				price_id: catalog[f.plan].id,
				plan_code: f.plan,
				unit_amount: amount,
				target_period_start: sub.items.data[0].current_period_end,
				review_revision: "sandbox-proof",
				state: "accepted",
				stripe_invoice_id: null,
				reason: "",
				created_at: new Date().toISOString(),
			};
			save();
		}
		record("initial-invoice", {
			label: f.label,
			subscription: sub.id,
			invoice: invoice.id,
			paid: invoice.amount_paid,
			checkout: f.checkoutId ?? null,
		});
	}
	async function fulfill(f: Fixture, invoice: Stripe.Invoice) {
		const claim = required(f.claim);
		await fulfillRetentionInvoice(invoice, {
			stripe,
			find: async (id) => (id === f.subscriptionId ? (f.claim ?? null) : null),
			bind: async (claimId, invoiceId) => {
				assert.equal(claimId, claim.id);
				assert.ok(
					!claim.stripe_invoice_id || claim.stripe_invoice_id === invoiceId,
				);
				claim.stripe_invoice_id = invoiceId;
				save();
				return { ...claim };
			},
			finish: async (claimId, invoiceId, state, reason) => {
				assert.equal(claimId, claim.id);
				assert.equal(invoiceId, claim.stripe_invoice_id);
				claim.state = state;
				claim.reason = reason;
				save();
			},
		});
	}
	const renewal = proof.fixtures.filter((f) => f.claim);
	const manual = await stripe.invoices.create({
		customer: renewal[0].customerId,
		auto_advance: false,
		metadata: { anidachiProof: "uninstall_2026", proofRun: proof.run },
	});
	await fulfill(renewal[0], manual);
	assert.equal(required(renewal[0].claim).state, "accepted");
	record("manual-invoice-ignored", { invoice: manual.id });
	const annualFixture = required(
		proof.fixtures.find((f) => f.label === "annual-guard"),
	);
	const annualPrices = await stripe.prices.list({
		product: prices[0].product as string,
		active: true,
		limit: 100,
	});
	const annual = annualPrices.data.filter(
		(p) => p.recurring?.interval === "year" && p.currency === "usd",
	);
	assert.equal(annual.length, 1);
	const old = await stripe.subscriptions.retrieve(
		required(annualFixture.subscriptionId),
	);
	const changed = await stripe.subscriptions.update(old.id, {
		items: [{ id: old.items.data[0].id, price: annual[0].id }],
		proration_behavior: "always_invoice",
	});
	const annualInvoice = await stripe.invoices.retrieve(
		changed.latest_invoice as string,
	);
	assert.equal(annualInvoice.billing_reason, "subscription_update");
	assert.equal(annualInvoice.total_discount_amounts?.length ?? 0, 0);
	await fulfill(renewal[0], annualInvoice);
	assert.equal(required(renewal[0].claim).state, "accepted");
	record("annual-proration-not-discounted", {
		invoice: annualInvoice.id,
		reason: annualInvoice.billing_reason,
	});

	async function advance(clockId: string, time: number) {
		await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: time });
		for (let n = 0; n < 50; n++) {
			const state = await stripe.testHelpers.testClocks.retrieve(clockId);
			if (state.status === "ready") return;
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
		throw new Error("Sandbox test clock did not become ready");
	}
	for (let cycle = 1; cycle <= 2; cycle++) {
		const before = await stripe.subscriptions.retrieve(
			required(renewal[0].subscriptionId),
		);
		for (const clockId of [proof.clock, required(proof.extraClock)])
			await advance(clockId, before.items.data[0].current_period_end + 60);
		for (const f of proof.fixtures.filter((f) => f.label !== "annual-guard")) {
			const sub = await stripe.subscriptions.retrieve(
				required(f.subscriptionId),
			);
			let invoice = await stripe.invoices.retrieve(
				sub.latest_invoice as string,
			);
			assert.equal(invoice.billing_reason, "subscription_cycle");
			assert.equal(
				invoice.status,
				"draft",
				"Need real renewal draft before automatic finalization",
			);
			assert.ok(invoice.id);
			const invoiceId = invoice.id;
			if (f.claim) {
				await fulfill(f, invoice);
				await fulfill(f, invoice);
			}
			invoice = await stripe.invoices.retrieve(invoiceId, {
				expand: ["discounts"],
			});
			const expected =
				cycle === 1 && f.claim
					? f.plan === "plus"
						? 479
						: 899
					: f.plan === "plus"
						? 799
						: 1499;
			assert.equal(invoice.total, expected);
			if (cycle === 1 && f.claim) assert.equal(f.claim.state, "applied");
			const finalized = await stripe.invoices.finalizeInvoice(invoiceId, {
				auto_advance: false,
			});
			assert.equal(finalized.total, expected);
			const paid =
				finalized.status === "paid"
					? finalized
					: await stripe.invoices.pay(invoiceId);
			assert.equal(paid.status, "paid");
			assert.equal(paid.amount_paid, expected);
			record("renewal-cycle", {
				cycle,
				label: f.label,
				invoice: invoice.id,
				amount: paid.amount_paid,
				claimState: f.claim?.state ?? null,
			});
		}
	}
	for (const f of proof.fixtures) {
		const sub = await stripe.subscriptions.retrieve(required(f.subscriptionId));
		assert.equal(sub.metadata.proofRun, proof.run);
		assert.equal(sub.livemode, false);
		await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
	}
	proof.phase = "passed";
	save();
	console.log(
		"PASS: real Sandbox first-month/renewal invoices, following month full price, same-promo replay, manual/annual isolation. SQL lifetime authority and hosted delivery are separate evidence.",
	);
}
void main().catch((error) => {
	console.error(
		error instanceof Error ? error.message : "Sandbox proof failed",
	);
	process.exitCode = 1;
});
