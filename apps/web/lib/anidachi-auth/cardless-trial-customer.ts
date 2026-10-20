import type Stripe from "stripe";
import { db } from "./db";
import { createStripeClient, resolveStripeMode } from "./stripe-env";

type TrialCustomerContact = {
	userId: string;
	activationId: string;
	customerId: string;
	email: string;
	verifiedEmail: string;
	name: string | null;
};
type ContactDeps = {
	stripe: Stripe;
	livemode: boolean;
	readContact(userId: string): Promise<TrialCustomerContact | null>;
};
const REQUEST = { timeout: 4000, maxNetworkRetries: 0 } as const;

/** Presentation-only repair: never changes customer creation/idempotency or
 * subscription terms. Called after the successful trial response. */
export async function syncCardlessTrialCustomerContact(
	userId: string,
	deps: ContactDeps = {
		stripe: createStripeClient(),
		livemode: resolveStripeMode() === "live",
		readContact: readCommittedTrialContact,
	},
): Promise<"updated" | "unchanged" | "skipped"> {
	const contact = await deps.readContact(userId);
	if (
		!contact ||
		contact.userId !== userId ||
		!contact.activationId ||
		!contact.customerId ||
		!contact.email?.trim() ||
		contact.email.length > 512 ||
		contact.email !== contact.verifiedEmail
	)
		return "skipped";
	const customer = await deps.stripe.customers.retrieve(
		contact.customerId,
		{},
		REQUEST,
	);
	if (
		customer.deleted ||
		customer.id !== contact.customerId ||
		customer.livemode !== deps.livemode ||
		customer.metadata.userId !== userId ||
		customer.metadata.trialActivationId !== contact.activationId
	)
		throw new Error("Trial customer contact ownership mismatch");
	const patch: Stripe.CustomerUpdateParams = {};
	// Keep billing details entered in Stripe. Account identity remains metadata.
	if (!customer.email?.trim()) patch.email = contact.email;
	if (!customer.name?.trim() && contact.name?.trim())
		patch.name = contact.name.trim().slice(0, 256);
	if (!Object.keys(patch).length) return "unchanged";
	// A separate update keeps legacy metadata-only create retries compatible and
	// allows a lost update response to be recovered with a fresh Customer read.
	await deps.stripe.customers.update(customer.id, patch, REQUEST);
	return "updated";
}

async function readCommittedTrialContact(
	userId: string,
): Promise<TrialCustomerContact | null> {
	const client = db();
	const [activation, user, proof] = await Promise.all([
		client
			.from("subscription_trial_activations")
			.select("id,user_id,stripe_customer_id")
			.eq("user_id", userId)
			.eq("state", "committed")
			.abortSignal(AbortSignal.timeout(4000))
			.maybeSingle(),
		client
			.from("users")
			.select("id,email,display_name")
			.eq("id", userId)
			.abortSignal(AbortSignal.timeout(4000))
			.maybeSingle(),
		client
			.from("account_verified_emails")
			.select("user_id,email")
			.eq("user_id", userId)
			.abortSignal(AbortSignal.timeout(4000))
			.maybeSingle(),
	]);
	if (activation.error || user.error || proof.error)
		throw new Error("Trial customer contact unavailable");
	if (
		activation.data?.user_id !== userId ||
		user.data?.id !== userId ||
		proof.data?.user_id !== userId
	)
		return null;
	return {
		userId,
		activationId: activation.data.id,
		customerId: activation.data.stripe_customer_id,
		email: user.data.email,
		verifiedEmail: proof.data.email,
		name: user.data.display_name,
	};
}
