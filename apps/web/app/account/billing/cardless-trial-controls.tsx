"use client";

import { useState } from "react";
import {
	billingPeriodUnit,
	formatBillingTime,
	formatMonthlyPrice,
	type BillingPeriod,
	type BillingSubscription,
} from "@/lib/billing-view";
import type { TrialRenewalQuote } from "@/lib/anidachi-auth/trial-renewal";

export type CardlessRenewalAction = "quote" | "setup" | "complete" | "cancel";
export type CardlessQuoteView = { quote: TrialRenewalQuote; requestId: string };

/** Uses the same controls in billing and the local preview. All writes belong to the caller. */
export function CardlessTrialControls({
	subscription,
	busy,
	quote,
	onAction,
	onDismiss,
}: {
	subscription: BillingSubscription;
	busy: boolean;
	quote: CardlessQuoteView | null;
	onAction: (
		action: CardlessRenewalAction,
		body: Record<string, unknown>,
	) => Promise<void>;
	onDismiss: () => void;
}) {
	const [planCode, setPlan] = useState(
		subscription.planCode === "pro" ? "pro" : "plus",
	);
	const [billingPeriod, setPeriod] = useState<BillingPeriod>(
		subscription.price?.billingPeriod ?? "monthly",
	);
	const trial = subscription.trial;
	if (
		!trial ||
		trial.mode !== "cardless" ||
		(trial.stage !== "trial" && !trial.pendingRenewal)
	)
		return null;
	const pending = trial.pendingRenewal;
	return (
		<section className="billing-trial-controls" aria-label="Trial renewal">
			<h3>
				{trial.renewalState === "enabled"
					? "Manage trial renewal"
					: pending
						? "Confirming your change"
						: "Keep watching after your trial"}
			</h3>
			{pending ? (
				<>
					<p className="ac-muted">
						{pending.action === "cancel"
							? trial.renewalEnabled
								? "Renewal remains enabled until cancellation is confirmed. Check its status below."
								: "Cancellation is still being confirmed. Check its status below."
							: "Card setup or renewal confirmation is unfinished. Check its status, resume setup, or cancel this change."}
					</p>
					{pending.terms && (
						<p>
							{pending.terms.planCode === "pro" ? "Pro" : "Plus"} ·{" "}
							{formatMonthlyPrice(pending.terms.price)}/
							{billingPeriodUnit(pending.terms.price.billingPeriod)}. First
							payment: {formatBillingTime(pending.terms.firstChargeAt)}.
							Completing setup enables automatic renewal from that date.
						</p>
					)}
					<div className="billing-actions">
						<button
							type="button"
							className="ac-button"
							disabled={busy}
							onClick={() =>
								void onAction("complete", { operationId: pending.id })
							}
						>
							Check renewal status
						</button>
						{trial.stage === "trial" &&
							pending.setupRequestId &&
							pending.terms && (
								<button
									type="button"
									className="ac-button ac-button-primary"
									disabled={busy}
									onClick={() =>
										void onAction("setup", {
											quoteId: pending.id,
											requestId: pending.setupRequestId,
										})
									}
								>
									Resume card setup
								</button>
							)}
					</div>
				</>
			) : (
				<>
					<p className="ac-muted">
						Choose the plan you want after the trial. Review the price and first
						payment date before adding a card.
					</p>
					<div className="billing-trial-selection">
						<label>
							Plan
							<select
								aria-label="Renewal plan"
								value={planCode}
								disabled={busy}
								onChange={(e) => {
									setPlan(e.target.value);
									onDismiss();
								}}
							>
								<option value="plus">Plus</option>
								<option value="pro">Pro</option>
							</select>
						</label>
						<label>
							Billing
							<select
								aria-label="Renewal billing period"
								value={billingPeriod}
								disabled={busy}
								onChange={(e) => {
									setPeriod(e.target.value as BillingPeriod);
									onDismiss();
								}}
							>
								<option value="monthly">Monthly</option>
								<option value="yearly">Yearly</option>
							</select>
						</label>
					</div>
					{!quote ? (
						<button
							type="button"
							className="ac-button ac-button-primary"
							disabled={busy}
							onClick={() =>
								void onAction("quote", { planCode, billingPeriod })
							}
						>
							Review renewal
						</button>
					) : (
						<div
							className="billing-trial-review"
							aria-label="Review renewal terms"
						>
							<p className="billing-trial-review-price">
								{quote.quote.planCode === "pro" ? "Pro" : "Plus"} ·{" "}
								{formatMonthlyPrice({
									unitAmount: quote.quote.amount,
									currency: quote.quote.currency,
								})}
								/{billingPeriodUnit(quote.quote.billingPeriod)}
							</p>
							<p>
								First payment:{" "}
								<strong>{formatBillingTime(quote.quote.firstChargeAt)}</strong>.
							</p>
							<p className="ac-muted">
								No payment today. By continuing and completing card setup, you
								enable automatic renewal every{" "}
								{billingPeriodUnit(quote.quote.billingPeriod)} from that date.
								Cancel renewal in Billing before the trial ends to avoid the
								first charge. Your trial end stays the same.
							</p>
							<p className="billing-tax-note">
								Taxes, discounts and credits may change the final total.
							</p>
							<div className="billing-actions">
								<button
									type="button"
									className="ac-button ac-button-primary"
									disabled={busy}
									onClick={() =>
										void onAction("setup", {
											quoteId: quote.quote.id,
											requestId: quote.requestId,
										})
									}
								>
									Add card &amp; enable renewal
								</button>
								<button
									type="button"
									className="ac-button ac-button-quiet"
									disabled={busy}
									onClick={onDismiss}
								>
									Back
								</button>
							</div>
						</div>
					)}
				</>
			)}
			{trial.stage === "trial" && (trial.renewalEnabled || pending) && (
				<button
					type="button"
					className="ac-button ac-button-quiet"
					disabled={busy}
					onClick={() => void onAction("cancel", {})}
				>
					{pending && !trial.renewalEnabled
						? "Cancel renewal setup"
						: "Cancel trial renewal"}
				</button>
			)}
		</section>
	);
}
