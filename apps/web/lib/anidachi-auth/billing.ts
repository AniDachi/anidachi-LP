import type { BillingOverview, BillingSubscription } from "../billing-view";
import { resolveAccountEntitlements } from "./account-entitlements";
import { getBillingCustomerByUserId, listSubscriptionsForUser } from "./db";
import { createStripeClient, resolveStripeMode } from "./stripe-env";
import { syncStripeSubscriptionById } from "./stripe-subscription-sync";

export class BillingError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "BillingError";
	}
}

const CANCELABLE_STATUSES = new Set([
	"active",
	"trialing",
	"past_due",
	"unpaid",
	"paused",
]);
const STRIPE_REQUEST = { timeout: 15_000, maxNetworkRetries: 0 };

export function canCancelSubscription(
	status: string,
	cancelAtPeriodEnd: boolean,
): boolean {
	return CANCELABLE_STATUSES.has(status) && !cancelAtPeriodEnd;
}

type BillingDeps = {
	listSubscriptions: typeof listSubscriptionsForUser;
	getCustomer: typeof getBillingCustomerByUserId;
	resolveEntitlements: typeof resolveAccountEntitlements;
	createStripe: typeof createStripeClient;
	sync: typeof syncStripeSubscriptionById;
	mode: typeof resolveStripeMode;
};

const defaultDeps: BillingDeps = {
	listSubscriptions: listSubscriptionsForUser,
	getCustomer: getBillingCustomerByUserId,
	resolveEntitlements: resolveAccountEntitlements,
	createStripe: createStripeClient,
	sync: syncStripeSubscriptionById,
	mode: resolveStripeMode,
};

export function createBillingService(deps: BillingDeps = defaultDeps) {
	async function ownedSubscriptions(userId: string) {
		const rows = await deps.listSubscriptions(userId);
		if (rows.some((row) => row.user_id !== userId)) {
			throw new BillingError(
				503,
				"Subscription ownership could not be verified.",
			);
		}
		return rows;
	}

	return {
		async overview(userId: string): Promise<BillingOverview> {
			const [rows, access] = await Promise.all([
				ownedSubscriptions(userId),
				deps.resolveEntitlements(userId, new Date()),
			]);
			const subscriptions: BillingSubscription[] = rows
				.sort((a, b) => b.created_at.localeCompare(a.created_at))
				.map((row) => ({
					id: row.id,
					planCode: row.plan_code,
					status: row.status,
					currentPeriodEnd: row.current_period_end,
					cancelAtPeriodEnd: row.cancel_at_period_end,
					canCancel: canCancelSubscription(
						row.status,
						row.cancel_at_period_end,
					),
				}));
			return {
				ownerUserId: userId,
				planCode: access.policy.planCode,
				subscriptions,
			};
		},

		async refresh(userId: string): Promise<void> {
			const rows = await ownedSubscriptions(userId);
			// Ended subscriptions cannot renew. Pending cancellation remains refreshable.
			const refreshable = rows.filter(
				(row) => !["canceled", "incomplete_expired"].includes(row.status),
			);
			if (refreshable.length === 0) return;
			const stripe = deps.createStripe();
			for (const row of refreshable) {
				const result = await deps.sync(stripe, row.stripe_subscription_id, {
					expectedUserId: userId,
				});
				if (!result || result.userId !== userId)
					throw new BillingError(
						503,
						"Subscription could not be refreshed. Please try again.",
					);
			}
		},

		async cancellationPortal(
			userId: string,
			rowId: string,
			returnUrl: string,
		): Promise<string> {
			const [rows, customer] = await Promise.all([
				ownedSubscriptions(userId),
				deps.getCustomer(userId),
			]);
			// The client selects only a local row; Stripe identifiers come from its owner-scoped mirror.
			const row = rows.find((item) => item.id === rowId);
			if (!row)
				throw new BillingError(404, "Subscription not found for this account.");
			if (
				!customer ||
				customer.user_id !== userId ||
				customer.stripe_customer_id !== row.stripe_customer_id
			) {
				throw new BillingError(
					503,
					"Subscription ownership could not be verified.",
				);
			}
			const stripe = deps.createStripe();
			const result = await deps.sync(stripe, row.stripe_subscription_id, {
				expectedUserId: userId,
			});
			if (
				!result ||
				result.userId !== userId ||
				result.stripeCustomerId !== customer.stripe_customer_id ||
				result.stripeSubscriptionId !== row.stripe_subscription_id
			) {
				throw new BillingError(
					503,
					"Subscription ownership could not be verified.",
				);
			}
			if (!canCancelSubscription(result.status, result.cancelAtPeriodEnd)) {
				throw new BillingError(
					409,
					"This subscription has already ended or its renewal is canceled. Refresh its status.",
				);
			}
			const configurations = await stripe.billingPortal.configurations.list(
				{ is_default: true, active: true, limit: 1 },
				STRIPE_REQUEST,
			);
			const config = configurations.data[0];
			const cancellation = config?.features.subscription_cancel;
			if (
				!config?.active ||
				!config.is_default ||
				config.livemode !== (deps.mode() === "live") ||
				!cancellation?.enabled ||
				cancellation.mode !== "at_period_end"
			) {
				throw new BillingError(
					503,
					"Subscription cancellation is temporarily unavailable. Please try again or contact support.",
				);
			}
			const portal = await stripe.billingPortal.sessions.create(
				{
					configuration: config.id,
					customer: customer.stripe_customer_id,
					return_url: returnUrl,
					flow_data: {
						type: "subscription_cancel",
						subscription_cancel: { subscription: result.stripeSubscriptionId },
						after_completion: {
							type: "redirect",
							redirect: { return_url: returnUrl },
						},
					},
				},
				STRIPE_REQUEST,
			);
			const url = new URL(portal.url);
			if (
				url.protocol !== "https:" ||
				url.hostname !== "billing.stripe.com" ||
				url.username ||
				url.password
			) {
				throw new BillingError(
					503,
					"Stripe returned an invalid subscription portal. Please contact support.",
				);
			}
			return portal.url;
		},
	};
}

export type BillingService = ReturnType<typeof createBillingService>;
