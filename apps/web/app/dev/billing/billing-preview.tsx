"use client";

import { useState } from "react";
import { BillingView } from "../../account/billing/billing-client";
import { AccountNav } from "../../account/account-nav";
import { AnidachiLogoLink } from "@/components/anidachi-logo";
import type { BillingOverview } from "@/lib/billing-view";

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
	const previewAction = async () => {
		setNotice("Preview only. No subscription changes were made.");
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
			<div className="account-frame">
				<aside className="account-sidebar">
					<AccountNav />
				</aside>
				<section className="account-content min-w-0">
					<BillingView
						ownerUserId="local-preview"
						overview={example}
						busy={false}
						error={null}
						notice={notice}
						planQuote={null}
						load={previewAction}
						changeTrial={previewAction}
						openStripe={previewAction}
						setPlanQuote={() => {}}
					/>
				</section>
			</div>
		</main>
	);
}
