import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { syncCardlessTrialCustomerContact } from "./cardless-trial-customer";

function fixture() {
	const contact = {
		userId: "owner",
		activationId: "activation",
		customerId: "cus_trial",
		email: "owner@example.com",
		verifiedEmail: "owner@example.com",
		name: " Trial Owner ",
	};
	const customer = {
		id: contact.customerId,
		livemode: false,
		metadata: {
			userId: contact.userId,
			trialActivationId: contact.activationId,
		},
		email: null as string | null,
		name: null as string | null,
	};
	const updates: Stripe.CustomerUpdateParams[] = [];
	let reads = 0;
	const deps = {
		livemode: false,
		readContact: async (userId: string) => {
			assert.equal(userId, "owner");
			return contact;
		},
		stripe: {
			customers: {
				retrieve: async (id: string) => {
					assert.equal(id, contact.customerId);
					reads++;
					return customer;
				},
				update: async (id: string, patch: Stripe.CustomerUpdateParams) => {
					assert.equal(id, customer.id);
					updates.push(patch);
					Object.assign(customer, patch);
					return customer;
				},
			},
		} as unknown as Stripe,
	};
	return { contact, customer, updates, deps, reads: () => reads };
}

test("fills only verified contact fields and repeated recovery does not write again", async () => {
	const f = fixture();
	assert.equal(
		await syncCardlessTrialCustomerContact("owner", f.deps),
		"updated",
	);
	assert.deepEqual(f.updates, [
		{ email: "owner@example.com", name: "Trial Owner" },
	]);
	assert.equal(
		await syncCardlessTrialCustomerContact("owner", f.deps),
		"unchanged",
	);
	assert.equal(f.updates.length, 1);
	assert.deepEqual(f.customer.metadata, {
		userId: "owner",
		trialActivationId: "activation",
	});
});

test("preserves billing contact details already entered in Stripe", async () => {
	const f = fixture();
	f.customer.email = "billing@example.com";
	f.customer.name = "Billing Owner";
	assert.equal(
		await syncCardlessTrialCustomerContact("owner", f.deps),
		"unchanged",
	);
	assert.deepEqual(f.updates, []);
	f.customer.name = null;
	await syncCardlessTrialCustomerContact("owner", f.deps);
	assert.deepEqual(f.updates, [{ name: "Trial Owner" }]);
	assert.equal(f.customer.email, "billing@example.com");
});

test("unverified, missing or foreign account contact cannot reach Stripe", async () => {
	for (const invalid of [
		{ userId: "other" },
		{ verifiedEmail: "previous@example.com" },
		{ email: "", verifiedEmail: "" },
		{ customerId: "" },
		{ activationId: "" },
	]) {
		const f = fixture();
		Object.assign(f.contact, invalid);
		assert.equal(
			await syncCardlessTrialCustomerContact("owner", f.deps),
			"skipped",
		);
		assert.equal(f.reads(), 0);
		assert.equal(f.updates.length, 0);
	}
	const f = fixture();
	assert.equal(
		await syncCardlessTrialCustomerContact("owner", {
			...f.deps,
			readContact: async () => null,
		}),
		"skipped",
	);
});

test("deleted, foreign, wrong-mode or differently bound Stripe customers are never updated", async () => {
	for (const invalid of [
		{ deleted: true },
		{ id: "cus_other" },
		{ livemode: true },
		{ metadata: { userId: "other", trialActivationId: "activation" } },
		{ metadata: { userId: "owner", trialActivationId: "other" } },
	]) {
		const f = fixture();
		Object.assign(f.customer, invalid);
		await assert.rejects(
			syncCardlessTrialCustomerContact("owner", f.deps),
			/ownership/,
		);
		assert.deepEqual(f.updates, []);
	}
});

test("lost update response is recovered by reading the same customer, without another write", async () => {
	const f = fixture();
	const update = f.deps.stripe.customers.update;
	f.deps.stripe.customers.update = (async (
		...args: Parameters<typeof update>
	) => {
		await update(...args);
		throw new Error("lost response");
	}) as typeof update;
	await assert.rejects(
		syncCardlessTrialCustomerContact("owner", f.deps),
		/lost response/,
	);
	assert.equal(
		await syncCardlessTrialCustomerContact("owner", f.deps),
		"unchanged",
	);
	assert.equal(f.updates.length, 1);
});

test("database failure cannot write a customer, and missing display name does not clear one", async () => {
	const f = fixture();
	await assert.rejects(
		syncCardlessTrialCustomerContact("owner", {
			...f.deps,
			readContact: async () => {
				throw new Error("database unavailable");
			},
		}),
	);
	assert.equal(f.reads(), 0);
	f.contact.name = " ";
	await syncCardlessTrialCustomerContact("owner", f.deps);
	assert.deepEqual(f.updates, [{ email: "owner@example.com" }]);
});
