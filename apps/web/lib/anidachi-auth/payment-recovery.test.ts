import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import type { SubscriptionRow } from "./db";
import { paymentRecoveryLink } from "./payment-recovery";
function fixture(
	change: Record<string, unknown> = {},
	subChange: Record<string, unknown> = {},
) {
	const invoice = {
		id: "in_owner",
		customer: "cus_owner",
		parent: { subscription_details: { subscription: "sub_owner" } },
		livemode: false,
		status: "open",
		hosted_invoice_url: "https://invoice.stripe.com/i/test",
		...change,
	};
	const sub = {
		id: "sub_owner",
		customer: "cus_owner",
		livemode: false,
		metadata: { userId: "owner" },
		status: "past_due",
		latest_invoice: "in_owner",
		...subChange,
	};
	return {
		listSubscriptions: async () =>
			[
				{
					id: "local",
					user_id: "owner",
					stripe_subscription_id: "sub_owner",
					stripe_customer_id: "cus_owner",
				},
			] as SubscriptionRow[],
		getCustomer: async () => ({
			user_id: "owner",
			stripe_customer_id: "cus_owner",
			created_at: "",
			updated_at: "",
		}),
		mode: () => "test" as const,
		createStripe: () =>
			({
				subscriptions: { retrieve: async () => sub },
				invoices: { retrieve: async () => invoice },
			}) as unknown as Stripe,
	};
}
test("payment recovery returns only the owner's open Stripe invoice", async () => {
	assert.equal(
		await paymentRecoveryLink("owner", "local", fixture()),
		"https://invoice.stripe.com/i/test",
	);
	await assert.rejects(
		paymentRecoveryLink("owner", "sub_owner", fixture()),
		/not found/,
	);
	for (const change of [
		{ customer: "foreign" },
		{ parent: { subscription_details: { subscription: "foreign" } } },
		{ id: "wrong" },
		{ livemode: true },
		{ status: "paid" },
		{ hosted_invoice_url: "https://evil.example/" },
		{ hosted_invoice_url: "https://invoice.stripe.com.evil.example/" },
		{ hosted_invoice_url: null },
	]) {
		await assert.rejects(
			paymentRecoveryLink("owner", "local", fixture(change)),
		);
	}
	for (const change of [
		{ customer: "foreign" },
		{ metadata: { userId: "foreign" } },
		{ livemode: true },
		{ status: "canceled" },
		{ latest_invoice: null },
	]) {
		await assert.rejects(
			paymentRecoveryLink("owner", "local", fixture({}, change)),
		);
	}
});
