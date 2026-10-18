"use client";

import { useEffect, useRef } from "react";
import { useBillingTimeZone } from "./use-billing-time-zone";
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
export type CardlessRenewalSelection = {
	planCode: "plus" | "pro";
	billingPeriod: BillingPeriod;
};

/** Uses the same controls in billing and the local preview. All writes belong to the caller. */
export function CardlessTrialControls({
	subscription,
	selection,
	onSelectionChange,
	busy,
	quote,
	onAction,
	onDismiss,
	active = false,
	onBack,
}: {
	subscription: BillingSubscription;
	selection: CardlessRenewalSelection;
	onSelectionChange: (selection: CardlessRenewalSelection) => void;
	busy: boolean;
	quote: CardlessQuoteView | null;
	onAction: (
		action: CardlessRenewalAction,
		body: Record<string, unknown>,
	) => Promise<void>;
	onDismiss: () => void;
	active?: boolean;
	onBack?: () => void;
}) {
	const timeZone = useBillingTimeZone();
	const { planCode, billingPeriod } = selection;
	const trial = subscription.trial;
	const pending = trial?.pendingRenewal;
	const enabled = trial?.renewalEnabled || trial?.renewalState === "enabled";
	const automaticReview = useRef<string | null>(null);
	// Fetch once when the user opens setup or changes a selection. No polling,
	// automatic error retries, or quote recreation after its expiry.
	useEffect(() => {
		if (
			!active ||
			busy ||
			pending ||
			enabled ||
			quote ||
			trial?.mode !== "cardless" ||
			trial?.stage !== "trial" ||
			trial.renewalState === "pending"
		)
			return;
		const key = `${subscription.id}:${planCode}:${billingPeriod}`;
		if (automaticReview.current === key) return;
		let disposed = false;
		queueMicrotask(() => {
			if (disposed) return;
			automaticReview.current = key;
			void onAction("quote", { planCode, billingPeriod });
		});
		return () => {
			disposed = true;
		};
	}, [
		active,
		busy,
		pending,
		enabled,
		quote,
		trial?.mode,
		trial?.stage,
		trial?.renewalState,
		subscription.id,
		planCode,
		billingPeriod,
		onAction,
	]);
	if (
		!trial ||
		trial.mode !== "cardless" ||
		(trial.stage !== "trial" && !trial.pendingRenewal)
	)
		return null;
	if (trial.renewalState === "pending" && !pending)
		return (
			<section className="billing-trial-controls" aria-label="Trial renewal">
				<h2>Confirming your renewal</h2>
				<p>Refresh status to check this change before continuing.</p>
			</section>
		);
	const validQuote =
		quote?.quote.planCode === planCode &&
		quote.quote.billingPeriod === billingPeriod
			? quote
			: null;
	return (
		<section className="billing-trial-controls" aria-label="Trial renewal">
			<header className="billing-renewal-heading">
				<h2>
					{pending ? (
						"Confirming your change"
					) : enabled ? (
						"Manage trial renewal"
					) : (
						<>
							Keep <span>{planCode === "pro" ? "Pro" : "Plus"}</span> after your
							trial
						</>
					)}
				</h2>
				{!pending && (
					<p>
						{enabled
							? "Your trial is active. Renewal is enabled."
							: "Your trial is active. Renewal is off."}
					</p>
				)}
			</header>
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
							payment:{" "}
							{formatBillingTime(pending.terms.firstChargeAt, timeZone)}.
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
					<div className="billing-trial-selection">
						<fieldset disabled={busy} aria-label="Renewal plan">
							<legend>Plan</legend>
							<div className="billing-segments">
								{(["plus", "pro"] as const).map((value) => (
									<label key={value}>
										<input
											type="radio"
											name={`renewal-plan-${subscription.id}`}
											value={value}
											checked={planCode === value}
											onChange={() => {
												onSelectionChange({ ...selection, planCode: value });
												onDismiss();
											}}
										/>
										<span>{value === "plus" ? "Plus" : "Pro"}</span>
									</label>
								))}
							</div>
						</fieldset>
						<fieldset disabled={busy} aria-label="Renewal billing period">
							<legend>Billing</legend>
							<div className="billing-segments">
								{(["monthly", "yearly"] as const).map((value) => (
									<label key={value}>
										<input
											type="radio"
											name={`renewal-period-${subscription.id}`}
											value={value}
											checked={billingPeriod === value}
											onChange={() => {
												onSelectionChange({
													...selection,
													billingPeriod: value,
												});
												onDismiss();
											}}
										/>
										<span>{value === "monthly" ? "Monthly" : "Yearly"}</span>
									</label>
								))}
							</div>
						</fieldset>
					</div>
					{!validQuote ? (
						<div className="billing-renewal-unquoted">
							<p className="ac-muted" role="status">
								{busy
									? "Loading renewal terms…"
									: "Review the price and first payment date before continuing."}
							</p>
							<button
								type="button"
								className="ac-button ac-button-primary"
								disabled={busy}
								onClick={() =>
									void onAction("quote", { planCode, billingPeriod })
								}
							>
								{enabled ? "Review changes" : "Review renewal"}
							</button>
						</div>
					) : (
						<div
							className="billing-trial-review"
							aria-label="Review renewal terms"
						>
							<div className="billing-renewal-timeline">
								<div>
									<p className="billing-timeline-label">Today</p>
									<p className="billing-timeline-amount">
										{new Intl.NumberFormat("en-US", {
											style: "currency",
											currency: validQuote.quote.currency,
											maximumFractionDigits: 0,
										}).format(0)}
									</p>
									<p className="ac-muted">Your trial continues</p>
								</div>
								<div>
									<p className="billing-timeline-label">First payment</p>
									<p className="billing-timeline-amount">
										{formatMonthlyPrice({
											unitAmount: validQuote.quote.amount,
											currency: validQuote.quote.currency,
										})}
										<span>
											{" "}
											/ {billingPeriodUnit(validQuote.quote.billingPeriod)}
										</span>
									</p>
									<p className="ac-muted">
										{formatBillingTime(
											validQuote.quote.firstChargeAt,
											timeZone,
										)}
									</p>
								</div>
							</div>
							<p className="ac-muted">
								{enabled
									? "No payment today. Confirming these changes sets "
									: "No payment today. Completing card setup enables "}
								{validQuote.quote.billingPeriod} automatic renewal after your
								trial.
								<br />
								Cancel before the first payment to avoid a charge.
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
											quoteId: validQuote.quote.id,
											requestId: validQuote.requestId,
										})
									}
								>
									{enabled
										? "Confirm renewal changes"
										: "Add card & enable renewal"}
								</button>
							</div>
						</div>
					)}
				</>
			)}
			{trial.stage === "trial" && (enabled || pending) && (
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
			{onBack && (
				<button
					type="button"
					className="ac-button ac-button-quiet billing-renewal-back"
					disabled={busy}
					onClick={onBack}
				>
					Not now
				</button>
			)}
		</section>
	);
}
