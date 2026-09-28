import type Stripe from "stripe";

import {
	beginStripeSubscriptionRefresh,
	commitStripeSubscriptionRefresh,
	getSubscriptionOwner,
	getSubscriptionTrial,
	getUserIdByStripeCustomerId,
	releaseStripeSubscriptionRefresh,
	type StripeRefreshLease,
	type StripeSubscriptionCommit,
} from "./db";
import type { PaidPlanCode, PlanCode } from "./plan-entitlements";
import {
	currentPeriodEndIso,
	paidPlanCodeFromStripeSubscription,
	stripeSubscriptionCancellationScheduled,
} from "./stripe-plans";
import {
	resolveStripeTrialSnapshot,
	type SubscriptionTrialRecord,
} from "./stripe-trial-state";

export class StripeSubscriptionSyncError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "StripeSubscriptionSyncError";
	}
}

export type StripeSubscriptionPlanResolution = {
	planCode: PaidPlanCode;
	stripePriceId: string;
};

export type StripeSubscriptionSyncResult = StripeSubscriptionPlanResolution & {
	userId: string;
	stripeCustomerId: string;
	stripeSubscriptionId: string;
	status: string;
	effectivePlan: PlanCode;
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: boolean;
};

function stripeCustomerIdFrom(
	value: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
	if (!value) return null;
	return typeof value === "string" ? value : value.id;
}

export function stripeSubscriptionIdFromUnknown(value: unknown): string | null {
	if (!value) return null;
	if (typeof value === "string") return value;
	if (typeof value === "object" && "id" in value) {
		const id = (value as { id?: unknown }).id;
		return typeof id === "string" ? id : null;
	}
	return null;
}

export function resolveStripeSubscriptionPlan(
	subscription: Stripe.Subscription,
): StripeSubscriptionPlanResolution {
	const stripePriceId = subscription.items.data[0]?.price.id;
	const planCode = paidPlanCodeFromStripeSubscription(subscription);
	if (!planCode || !stripePriceId) {
		throw new StripeSubscriptionSyncError(
			`Could not resolve subscription plan for ${subscription.id}`,
		);
	}

	return { planCode, stripePriceId };
}

export type SyncStripeSubscriptionDeps = {
	readTrial?: (
		subscriptionId: string,
	) => Promise<SubscriptionTrialRecord | null>;
	resolveUserId?: (stripeCustomerId: string) => Promise<string | null>;
	resolveSubscriptionOwner?: (subscriptionId: string) => Promise<string | null>;
	begin?: (subscriptionId: string) => Promise<StripeRefreshLease | null>;
	commit?: (
		params: StripeSubscriptionCommit,
		lease: StripeRefreshLease,
	) => Promise<PlanCode>;
	release?: (
		subscriptionId: string,
		lease: StripeRefreshLease,
	) => Promise<void>;
	expectedUserId?: string;
};

/** All entry points refetch AFTER acquiring durable authority; never trust event snapshots. */
export async function syncStripeSubscriptionById(
	stripe: Stripe,
	subscriptionId: string | null,
	deps: SyncStripeSubscriptionDeps = {},
): Promise<StripeSubscriptionSyncResult | null> {
	if (!subscriptionId) return null;
	const lease = await (deps.begin ?? beginStripeSubscriptionRefresh)(
		subscriptionId,
	);
	if (!lease)
		throw new StripeSubscriptionSyncError(
			"Stripe refresh busy; retry delivery",
		);
	const snapshotDeadline = Date.now() + 22_000;
	const requestOptions = () => {
		const remaining = snapshotDeadline - Date.now();
		if (remaining <= 0)
			throw new StripeSubscriptionSyncError(
				"Stripe snapshot deadline exceeded; retry delivery",
			);
		return { timeout: Math.min(8000, remaining), maxNetworkRetries: 0 };
	};
	try {
		// Finite request deadline stays below the 30s DB lease. No SDK retry can
		// retain an expired snapshot; retries must reacquire and retrieve anew.
		const subscription = await stripe.subscriptions.retrieve(
			subscriptionId,
			{},
			{ timeout: 15_000, maxNetworkRetries: 0 },
		);
		if (subscription.id !== subscriptionId)
			throw new StripeSubscriptionSyncError("Subscription identity mismatch");
		const stripeCustomerId = stripeCustomerIdFrom(subscription.customer);
		if (!stripeCustomerId)
			throw new StripeSubscriptionSyncError("Subscription missing customer");
		const [customerOwner, subscriptionOwner, priorTrial] = await Promise.all([
			(deps.resolveUserId ?? getUserIdByStripeCustomerId)(stripeCustomerId),
			(deps.resolveSubscriptionOwner ?? getSubscriptionOwner)(subscriptionId),
			(deps.readTrial ?? getSubscriptionTrial)(subscriptionId),
		]);
		const metadataOwner = subscription.metadata.userId;
		const owners = [
			customerOwner,
			subscriptionOwner,
			metadataOwner,
			deps.expectedUserId,
			priorTrial?.user_id,
		].filter(Boolean);
		if (new Set(owners).size > 1)
			throw new StripeSubscriptionSyncError("Subscription owner mismatch");
		const userId = subscriptionOwner || customerOwner || metadataOwner;
		if (!userId) return null; // Untracked Stripe customer; no mirror to mutate.
		const { planCode, stripePriceId } =
			resolveStripeSubscriptionPlan(subscription);
		const trial = await resolveStripeTrialSnapshot(
			stripe,
			subscription,
			priorTrial,
			requestOptions,
		);
		const effectivePlan = await (
			deps.commit ?? commitStripeSubscriptionRefresh
		)(
			{
				userId,
				stripeCustomerId,
				stripeSubscriptionId: subscription.id,
				stripePriceId,
				planCode,
				status: subscription.status,
				currentPeriodEnd: currentPeriodEndIso(subscription),
				// The existing mirror flag represents scheduled renewal cancellation in both billing modes.
				cancelAtPeriodEnd:
					stripeSubscriptionCancellationScheduled(subscription),
				trial,
			},
			lease,
		);
		return {
			userId,
			stripeCustomerId,
			stripeSubscriptionId: subscription.id,
			stripePriceId,
			planCode,
			status: subscription.status,
			effectivePlan,
			currentPeriodEnd: currentPeriodEndIso(subscription),
			cancelAtPeriodEnd: stripeSubscriptionCancellationScheduled(subscription),
		};
	} finally {
		// Fenced release cannot release a newer holder. Failure leaves only a bounded lease.
		await (deps.release ?? releaseStripeSubscriptionRefresh)(
			subscriptionId,
			lease,
		);
	}
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
	return stripeSubscriptionIdFromUnknown(
		invoice.parent?.subscription_details?.subscription,
	);
}
