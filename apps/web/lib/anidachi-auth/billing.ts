import { readPendingTrialActivation } from "./cardless-trial-status";
import type {
	BillingOverview,
	BillingSubscription,
	BillingTrial,
} from "../billing-view";
import { resolveAccountEntitlements } from "./account-entitlements";
import { readBillingPrice } from "./billing-price";
import {
	getBillingCustomerByUserId,
	getSubscriptionTrial,
	listSubscriptionsForUser,
} from "./db";
import {
	createStripeClient,
	resolveStripeMode,
	stripeEnvForMode,
} from "./stripe-env";
import { stripePriceIdForPlanCode } from "./stripe-plans";
import { syncStripeSubscriptionById } from "./stripe-subscription-sync";
import { readTrialRenewal } from "./trial-renewal-server";

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

function canRestoreRenewal(
	status: string,
	cancelAtPeriodEnd: boolean,
	periodEnd: string | null,
	now: number,
): boolean {
	return (
		["active", "trialing"].includes(status) &&
		cancelAtPeriodEnd &&
		Date.parse(periodEnd ?? "") > now
	);
}

type BillingDeps = {
	readActivation: typeof readPendingTrialActivation;
	now?: () => number;
	listSubscriptions: typeof listSubscriptionsForUser;
	getCustomer: typeof getBillingCustomerByUserId;
	resolveEntitlements: typeof resolveAccountEntitlements;
	createStripe: typeof createStripeClient;
	sync: typeof syncStripeSubscriptionById;
	mode: typeof resolveStripeMode;
	readTrial: typeof getSubscriptionTrial;
	readRenewal: typeof readTrialRenewal;
	readPrice: typeof readBillingPrice;
};

const defaultDeps: BillingDeps = {
	readActivation: readPendingTrialActivation,
	listSubscriptions: listSubscriptionsForUser,
	getCustomer: getBillingCustomerByUserId,
	resolveEntitlements: resolveAccountEntitlements,
	createStripe: createStripeClient,
	sync: syncStripeSubscriptionById,
	mode: resolveStripeMode,
	readTrial: getSubscriptionTrial,
	readRenewal: readTrialRenewal,
	readPrice: readBillingPrice,
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

	async function subscriptionPortal(
		userId: string,
		rowId: string,
		returnUrl: string,
		intent: "cancel" | "restore",
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
		const trial = await deps.readTrial(row.stripe_subscription_id);
		if (
			trial &&
			(trial.user_id !== userId ||
				trial.stripe_subscription_id !== row.stripe_subscription_id)
		)
			throw new BillingError(503, "Trial ownership could not be verified.");
		if (
			trial?.trial_mode === "cardless" &&
			trial.first_payment_state !== "paid" &&
			Date.parse(trial.trial_ends_at) > (deps.now ?? Date.now)()
		)
			throw new BillingError(
				409,
				"Use the trial renewal controls to confirm or cancel payment after your trial.",
			);
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
		const allowed =
			intent === "restore"
				? canRestoreRenewal(
						result.status,
						result.cancelAtPeriodEnd,
						result.currentPeriodEnd,
						(deps.now ?? Date.now)(),
					)
				: canCancelSubscription(result.status, result.cancelAtPeriodEnd);
		if (!allowed) {
			throw new BillingError(
				409,
				intent === "restore"
					? "Renewal can only be restored before a canceled trial or paid period ends. Refresh its status."
					: "This subscription has already ended or its renewal is canceled. Refresh its status.",
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
			cancellation.mode !== "at_period_end" ||
			// Generic Portal plan updates can end a trial early. Keep plan changes
			// in our existing quote/confirm flow that preserves its original end.
			(intent === "restore" &&
				config.features.subscription_update?.enabled !== false)
		) {
			throw new BillingError(
				503,
				"Subscription renewal management is temporarily unavailable. Please try again or contact support.",
			);
		}
		const portal = await stripe.billingPortal.sessions.create(
			{
				configuration: config.id,
				customer: customer.stripe_customer_id,
				return_url: returnUrl,
				...(intent === "cancel"
					? {
							flow_data: {
								type: "subscription_cancel",
								subscription_cancel: {
									subscription: result.stripeSubscriptionId,
								},
								after_completion: {
									type: "redirect",
									redirect: { return_url: returnUrl },
								},
							},
						}
					: {}),
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
	}

	return {
		async overview(userId: string): Promise<BillingOverview> {
			const [rows, access, pendingTrialActivation] = await Promise.all([
				ownedSubscriptions(userId),
				deps.resolveEntitlements(userId, new Date()),
				deps.readActivation(userId),
			]);
			const subscriptions: BillingSubscription[] = await Promise.all(
				rows
					.sort((a, b) => b.created_at.localeCompare(a.created_at))
					.map(async (row) => {
						const [record, price] = await Promise.all([
							deps.readTrial(row.stripe_subscription_id),
							deps.readPrice(row.stripe_price_id).catch(() => null),
						]);
						let trial: BillingTrial | undefined;
						if (record) {
							if (
								record.user_id !== userId ||
								record.stripe_subscription_id !== row.stripe_subscription_id
							)
								throw new BillingError(
									503,
									"Trial ownership could not be verified.",
								);
							const now = Date.parse(access.history.serverTime);
							const end = Date.parse(record.trial_ends_at);
							if (!Number.isFinite(now) || !Number.isFinite(end))
								throw new BillingError(503, "Trial timing unavailable.");
							const live = row.status === "active" || row.status === "trialing";
							const cardless = record.trial_mode === "cardless";
							const renewalEnabled = !!record.renewal_operation_id;
							const operation =
								cardless && record.first_payment_state !== "paid"
									? await deps.readRenewal(userId)
									: null;
							if (
								operation &&
								(operation.user_id !== userId ||
									operation.stripe_subscription_id !==
										row.stripe_subscription_id)
							)
								throw new BillingError(
									503,
									"Trial renewal ownership could not be verified.",
								);
							const pending =
								operation &&
								["setup_pending", "applying"].includes(operation.state)
									? operation
									: null;
							trial = {
								...(cardless
									? {
											mode: "cardless" as const,
											renewalState: pending
												? ("pending" as const)
												: renewalEnabled
													? ("enabled" as const)
													: ("not_enabled" as const),
											renewalEnabled,
											...(operation?.state === "quoted" &&
											operation.action === "enable" &&
											live &&
											end > now &&
											Date.parse(operation.quote_expires_at) > now &&
											Date.parse(operation.original_trial_end) === end
												? { renewalQuoteId: operation.id }
												: {}),
											...(pending
												? {
														pendingRenewal: {
															id: pending.id,
															action: pending.action,
															...(pending.action === "enable" &&
															pending.plan_code &&
															pending.billing_period &&
															pending.amount &&
															pending.currency
																? {
																		terms: {
																			planCode: pending.plan_code,
																			price: {
																				unitAmount: pending.amount,
																				currency: pending.currency,
																				billingPeriod: pending.billing_period,
																			},
																			firstChargeAt: pending.original_trial_end,
																		},
																	}
																: {}),
															...(pending.state === "setup_pending" &&
															pending.setup_request_id
																? { setupRequestId: pending.setup_request_id }
																: {}),
														},
													}
												: {}),
										}
									: {}),
								endsAt: record.trial_ends_at,
								pendingUntil: new Date(end + 2 * 3600_000).toISOString(),
								stage:
									record.first_payment_state === "paid"
										? "paid"
										: live && now < end
											? "trial"
											: ["failed", "action_required"].includes(
														record.first_payment_state,
													)
												? "payment_required"
												: live &&
														(!cardless || renewalEnabled) &&
														!row.cancel_at_period_end &&
														now < end + 2 * 3600_000
													? "processing"
													: "ended",
							};
						}
						const cardlessTrial =
							trial?.mode === "cardless" && trial.stage !== "paid";
						return {
							id: row.id,
							planCode: row.plan_code,
							status: row.status,
							currentPeriodEnd: row.current_period_end,
							cancelAtPeriodEnd: row.cancel_at_period_end,
							canCancel:
								!(cardlessTrial && trial?.stage === "trial") &&
								canCancelSubscription(row.status, row.cancel_at_period_end),
							canRestoreRenewal:
								!cardlessTrial &&
								canRestoreRenewal(
									row.status,
									row.cancel_at_period_end,
									row.current_period_end,
									Date.parse(access.history?.serverTime ?? ""),
								),
							price,
							canSwitchToYearly:
								!cardlessTrial &&
								price?.billingPeriod === "monthly" &&
								row.plan_code !== "free" &&
								!!stripePriceIdForPlanCode(row.plan_code, "yearly") &&
								!row.cancel_at_period_end &&
								((row.status === "trialing" && trial?.stage === "trial") ||
									(row.status === "active" &&
										(!trial || trial.stage === "paid") &&
										Date.parse(row.current_period_end ?? "") >
											Date.parse(access.history.serverTime) &&
										!!stripeEnvForMode(
											"STRIPE_YEARLY_PORTAL_CONFIGURATION_ID",
										))),
							monthlyPrice: price?.billingPeriod === "monthly" ? price : null,
							...(trial ? { trial } : {}),
							canChangeTrialPlan:
								!cardlessTrial &&
								trial?.stage === "trial" &&
								row.status === "trialing",
						};
					}),
			);
			return {
				ownerUserId: userId,
				...(pendingTrialActivation ? { pendingTrialActivation } : {}),
				planCode: access.policy.planCode,
				subscriptions,
				...(access.hosting ? { hosting: access.hosting } : {}),
				serverTime: access.history?.serverTime,
				selectedPlanExpiresAt: access.selectedPlanExpiresAt,
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

		cancellationPortal: (userId: string, rowId: string, returnUrl: string) =>
			subscriptionPortal(userId, rowId, returnUrl, "cancel"),
		renewalPortal: (userId: string, rowId: string, returnUrl: string) =>
			subscriptionPortal(userId, rowId, returnUrl, "restore"),
	};
}

export type BillingService = ReturnType<typeof createBillingService>;
