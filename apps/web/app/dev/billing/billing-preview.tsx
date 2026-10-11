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
			currentPeriodEnd: "2026-10-02T16:00:00Z",
			cancelAtPeriodEnd: false,
			canCancel: true,
			canRestoreRenewal: false,
			canChangeTrialPlan: true,
			trial: {
				stage: "trial",
				endsAt: "2026-10-02T16:00:00Z",
				pendingUntil: "2026-10-02T18:00:00Z",
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
	const [variant, setVariant] = useState("Card trial");
	const [quote, setQuote] = useState<CardlessQuoteView | null>(null);
	const [selection, setSelection] = useState<CardlessRenewalSelection>({
		planCode: "plus",
		billingPeriod: "monthly",
	});
	const isCardless = variant !== "Card trial";
	const enabled = variant === "Renewal enabled";
	const ended = variant === "Trial ended";
	const view: BillingOverview = isCardless
		? {
				...example,
				planCode: ended ? "free" : "plus",
				subscriptions: [
					{
						...example.subscriptions[0],
						status: ended ? "canceled" : "trialing",
						cancelAtPeriodEnd: !enabled,
						canCancel: false,
						canRestoreRenewal: false,
						canChangeTrialPlan: false,
						price: {
							...PUBLISHED_PRICING.monthly.plus,
							billingPeriod: "monthly",
						},
						trial: {
							mode: "cardless",
							stage: ended ? "ended" : "trial",
							endsAt: "2030-01-04T16:00:00Z",
							pendingUntil: "2030-01-04T18:00:00Z",
							renewalState: enabled ? "enabled" : "not_enabled",
							renewalEnabled: enabled,
						},
					},
				],
			}
		: example;
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
					<span className="account-plan">Plus</span>
					<span>Alex · Preview</span>
				</div>
			</header>
			<p className="px-4 py-4 text-center text-xs text-ani-muted">
				Local preview · sample subscription · payment actions are inactive
			</p>
			<div
				className="flex flex-wrap justify-center gap-2 px-4 pb-4"
				aria-label="Preview state"
			>
				{["Card trial", "Cardless trial", "Renewal enabled", "Trial ended"].map(
					(label) => (
						<button
							key={label}
							type="button"
							className="ac-button"
							aria-pressed={variant === label}
							onClick={() => {
								setVariant(label);
								setQuote(null);
								setNotice(null);
							}}
						>
							{label}
						</button>
					),
				)}
			</div>
			<div className="account-frame">
				<aside className="account-sidebar">
					<AccountNav />
				</aside>
				<section className="account-content min-w-0">
					<BillingView
						ownerUserId="local-preview"
						overview={view}
						busy={false}
						error={null}
						notice={notice}
						planQuote={null}
						load={previewAction}
						changeTrial={previewAction}
						openStripe={previewAction}
						setPlanQuote={() => {}}
						renderTrialControls={(s) => (
							<CardlessTrialControls
								key={variant}
								subscription={s}
								busy={false}
								quote={quote}
								selection={selection}
								onSelectionChange={setSelection}
								onAction={previewRenewal}
								onDismiss={() => setQuote(null)}
							/>
						)}
					/>
				</section>
			</div>
		</main>
	);
}
