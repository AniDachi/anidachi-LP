"use client";

import { useState } from "react";
import { BillingView } from "../../account/billing/billing-client";
import { AccountNav } from "../../account/account-nav";
import { AnidachiLogoLink } from "@/components/anidachi-logo";
import type { BillingOverview } from "@/lib/billing-view";
import {
	CardlessTrialControls,
	type CardlessQuoteView,
	type CardlessRenewalSelection,
	type CardlessRenewalAction,
} from "../../account/billing/cardless-trial-controls";
import { PUBLISHED_PRICING } from "@/lib/pricing-tiers";

const example: BillingOverview = {
	ownerUserId: "local-preview",
	planCode: "plus",
	subscriptions: [
		{
			id: "sample-subscription",
			planCode: "plus",
			status: "trialing",
			currentPeriodEnd: "2030-01-04T16:00:00Z",
			cancelAtPeriodEnd: false,
			canCancel: true,
			canRestoreRenewal: false,
			canChangeTrialPlan: true,
			trial: {
				stage: "trial",
				endsAt: "2030-01-04T16:00:00Z",
				pendingUntil: "2030-01-04T18:00:00Z",
			},
			price: { unitAmount: 7670, currency: "usd", billingPeriod: "yearly" },
		},
		{
			id: "sample-old-subscription",
			planCode: "plus",
			status: "canceled",
			currentPeriodEnd: "2026-10-01T12:00:00Z",
			cancelAtPeriodEnd: false,
			canCancel: false,
			price: { unitAmount: 799, currency: "usd", billingPeriod: "monthly" },
		},
	],
};
export function BillingPreview() {
	const [notice, setNotice] = useState<string | null>(null);
	const [variant, setVariant] = useState("Cardless trial");
	const [quote, setQuote] = useState<CardlessQuoteView | null>(null);
	const [selection, setSelection] = useState<CardlessRenewalSelection>({
		planCode: "plus",
		billingPeriod: "monthly",
	});
	const isCardless = variant !== "Card trial";
	const enabled = variant === "Renewal enabled";
	const ended = variant === "Trial ended";
	const paid = ["Paid", "Paid yearly", "Renewal off"].includes(variant);
	const pending = variant === "Setup pending";
	const processing = variant === "Payment processing";
	const paymentRequired = variant === "Payment failed";
	let view: BillingOverview = paid
		? {
				...example,
				subscriptions: [
					{
						...example.subscriptions[0],
						trial: undefined,
						status: "active",
						currentPeriodEnd: "2030-02-04T16:00:00Z",
						canChangeTrialPlan: false,
						canCancel: variant !== "Renewal off",
						canRestoreRenewal: variant === "Renewal off",
						canSwitchToYearly: variant !== "Paid yearly",
						cancelAtPeriodEnd: variant === "Renewal off",
						price: {
							...PUBLISHED_PRICING[
								variant === "Paid yearly" ? "yearly" : "monthly"
							].plus,
							billingPeriod: variant === "Paid yearly" ? "yearly" : "monthly",
						},
					},
				],
			}
		: isCardless
			? {
					...example,
					planCode: ended || paymentRequired ? "free" : "plus",
					subscriptions: [
						{
							...example.subscriptions[0],
							status: ended
								? "canceled"
								: paymentRequired
									? "past_due"
									: processing
										? "active"
										: "trialing",
							cancelAtPeriodEnd: !(enabled || processing || paymentRequired),
							canCancel: false,
							canRestoreRenewal: false,
							canChangeTrialPlan: false,
							price: {
								...PUBLISHED_PRICING.monthly.plus,
								billingPeriod: "monthly",
							},
							trial: {
								mode: "cardless",
								stage: ended
									? "ended"
									: processing
										? "processing"
										: paymentRequired
											? "payment_required"
											: "trial",
								endsAt: "2030-01-04T16:00:00Z",
								pendingUntil: "2030-01-04T18:00:00Z",
								renewalState: pending
									? "pending"
									: enabled
										? "enabled"
										: "not_enabled",
								renewalEnabled: enabled,
								pendingRenewal: pending
									? {
											id: "sample-pending",
											action: "enable",
											setupRequestId: "sample-request",
											terms: {
												planCode: "plus",
												price: {
													...PUBLISHED_PRICING.monthly.plus,
													billingPeriod: "monthly",
												},
												firstChargeAt: "2030-01-04T16:00:00Z",
											},
										}
									: undefined,
							},
						},
					],
				}
			: example;
	if (
		[
			"Free",
			"Canceled",
			"Trial activation pending",
			"Loading",
			"Unavailable",
		].includes(variant)
	) {
		view = {
			...example,
			planCode: "free",
			subscriptions: variant === "Canceled" ? [example.subscriptions[1]] : [],
			pendingTrialActivation:
				variant === "Trial activation pending"
					? {
							id: "sample-activation",
							planCode: "plus",
							billingPeriod: "monthly",
						}
					: undefined,
		};
	}
	const otherStatus: Record<string, string> = {
		Overdue: "past_due",
		Unpaid: "unpaid",
		"Payment incomplete": "incomplete",
		Paused: "paused",
		"Unknown status": "unknown",
	};
	if (otherStatus[variant]) {
		view = {
			...example,
			planCode: "free",
			subscriptions: [
				{
					...example.subscriptions[0],
					status: otherStatus[variant],
					trial: undefined,
					canChangeTrialPlan: false,
					canCancel: false,
				},
			],
		};
	}
	if (variant === "Card trial renewal off") {
		view = {
			...example,
			subscriptions: [
				{
					...example.subscriptions[0],
					cancelAtPeriodEnd: true,
					canCancel: false,
					canRestoreRenewal: true,
				},
			],
		};
	}

	const previewAction = async () => {
		setNotice("Preview only. No subscription changes were made.");
	};
	const previewRenewal = async (
		action: CardlessRenewalAction,
		body: Record<string, unknown>,
	) => {
		if (action === "quote") {
			const planCode = body.planCode === "pro" ? "pro" : "plus";
			const billingPeriod =
				body.billingPeriod === "yearly" ? "yearly" : "monthly";
			const price = PUBLISHED_PRICING[billingPeriod][planCode];
			setQuote({
				requestId: "sample-request",
				quote: {
					id: "sample-quote",
					planCode,
					billingPeriod,
					amount: price.unitAmount,
					currency: price.currency,
					firstChargeAt: "2030-01-04T16:00:00Z",
					expiresAt: "2030-01-01T16:05:00Z",
					termsRevision: "sample",
				},
			});
		} else await previewAction();
	};
	return (
		<main
			id="main-content"
			className="account-workspace min-h-screen bg-background text-foreground/90"
		>
			<header className="account-header">
				<AnidachiLogoLink size={28} />
				<div className="account-identity">
					<span className="account-plan">{view.planCode}</span>
					<span>Alex · Preview</span>
				</div>
			</header>
			<details className="billing-preview-switcher">
				<summary className="px-4 py-3 text-center text-xs text-ani-muted">
					Local preview · sample subscription · {variant} · change state
				</summary>
				<p className="px-4 pb-3 text-center text-xs text-ani-muted">
					Payment actions are inactive.
				</p>
				<div
					className="flex flex-wrap justify-center gap-2 px-4 pb-4"
					aria-label="Preview state"
				>
					{[
						"Card trial",
						"Cardless trial",
						"Renewal enabled",
						"Trial ended",
						"Paid",
						"Renewal off",
						"Paid yearly",
						"Setup pending",
						"Payment processing",
						"Payment failed",
						"Free",
						"Canceled",
						"Trial activation pending",
						"Overdue",
						"Unpaid",
						"Payment incomplete",
						"Paused",
						"Unknown status",
						"Card trial renewal off",
						"Loading",
						"Unavailable",
					].map((label) => (
						<button
							key={label}
							type="button"
							className="ac-button"
							aria-pressed={variant === label}
							onClick={() => {
								setVariant(label);
								setQuote(null);
								setNotice(null);
								setSelection({ planCode: "plus", billingPeriod: "monthly" });
							}}
						>
							{label}
						</button>
					))}
				</div>
			</details>
			<div className="account-frame">
				<aside className="account-sidebar">
					<AccountNav />
				</aside>
				<section className="account-content min-w-0">
					<BillingView
						key={variant}
						ownerUserId="local-preview"
						overview={
							["Loading", "Unavailable"].includes(variant) ? null : view
						}
						busy={variant === "Loading"}
						error={
							variant === "Unavailable"
								? "We couldn’t load your subscription. Please refresh to try again."
								: null
						}
						notice={notice}
						planQuote={null}
						load={previewAction}
						changeTrial={previewAction}
						openStripe={previewAction}
						setPlanQuote={() => {}}
						renderTrialControls={(s, active, onBack) => (
							<CardlessTrialControls
								key={variant}
								subscription={s}
								active={active}
								onBack={onBack}
								busy={false}
								quote={quote}
								selection={selection}
								onSelectionChange={setSelection}
								onAction={previewRenewal}
								onPreview={async () => ({
									serverTime: new Date().toISOString(),
									expiresAt: new Date(Date.now() + 300000).toISOString(),
									firstChargeAt: s.trial!.endsAt,
									savedCard: enabled
										? { sourceId: "preview-card", brand: "visa", last4: "4242" }
										: null,
									options: (["plus", "pro"] as const).flatMap((planCode) =>
										(["monthly", "yearly"] as const).map((billingPeriod) => ({
											planCode,
											billingPeriod,
											amount:
												PUBLISHED_PRICING[billingPeriod][planCode].unitAmount,
											currency:
												PUBLISHED_PRICING[billingPeriod][planCode].currency,
										})),
									),
								})}
								onDismiss={() => setQuote(null)}
							/>
						)}
					/>
				</section>
			</div>
		</main>
	);
}
