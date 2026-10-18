"use client";

import { useEffect, useRef, useState } from "react";
import { useBillingTimeZone } from "./use-billing-time-zone";
import {
	billingPeriodUnit,
	formatBillingTime,
	formatMonthlyPrice,
	type BillingPeriod,
	type BillingSubscription,
} from "@/lib/billing-view";
import type {
	TrialRenewalQuote,
	TrialRenewalPreview,
} from "@/lib/anidachi-auth/trial-renewal";

export type CardlessRenewalAction =
	| "confirm"
	| "quote"
	| "setup"
	| "complete"
	| "cancel";
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
	onPreview,
	previewRevision = 0,
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
	onPreview?: () => Promise<TrialRenewalPreview>;
	previewRevision?: number;
}) {
	const timeZone = useBillingTimeZone();
	const { planCode, billingPeriod } = selection;
	const trial = subscription.trial;
	const pending = trial?.pendingRenewal;
	const enabled = trial?.renewalEnabled || trial?.renewalState === "enabled";
	const automaticReview = useRef<string | null>(null);
	const [preview, setPreview] = useState<TrialRenewalPreview | null>(null);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const previewReader = useRef(onPreview);
	previewReader.current = onPreview;
	const previewContext = JSON.stringify([
		subscription.id,
		subscription.planCode,
		subscription.price?.billingPeriod,
		subscription.price?.unitAmount,
		trial?.endsAt,
		trial?.renewalState,
		trial?.renewalEnabled,
		pending?.id,
		previewRevision,
	]);
	const [retry, setRetry] = useState(0);
	const previewCache = useRef<{ key: string; until: number } | null>(null);
	useEffect(() => {
		if (
			!active ||
			!previewReader.current ||
			pending ||
			trial?.mode !== "cardless" ||
			trial.stage !== "trial" ||
			trial.renewalState === "pending"
		)
			return;
		const key = `${previewContext}:${retry}`;
		if (
			previewCache.current?.key === key &&
			previewCache.current.until > Date.now()
		)
			return;
		let disposed = false;
		setPreviewLoading(true);
		setPreviewError(null);
		setPreview(null);
		void previewReader
			.current()
			.then((value) => {
				if (!disposed) {
					if (Date.parse(value.firstChargeAt) !== Date.parse(trial.endsAt))
						throw new Error(
							"Your trial changed. Refresh subscription status before continuing.",
						);
					previewCache.current = {
						key,
						until:
							Date.now() +
							Math.max(
								0,
								Date.parse(value.expiresAt) - Date.parse(value.serverTime),
							),
					};
					setPreview(value);
				}
			})
			.catch((e: unknown) => {
				if (!disposed)
					setPreviewError(
						e instanceof Error
							? e.message
							: "Renewal terms unavailable. Please try again.",
					);
			})
			.finally(() => {
				if (!disposed) setPreviewLoading(false);
			});
		return () => {
			disposed = true;
		};
	}, [active, previewContext, retry]);
	useEffect(() => {
		if (!preview) return;
		const timer = setTimeout(
			() => setPreview(null),
			Math.max(0, (previewCache.current?.until ?? 0) - Date.now()),
		);
		return () => clearTimeout(timer);
	}, [preview]);
	// Fetch once when the user opens setup or changes a selection. No polling,
	// automatic error retries, or quote recreation after its expiry.
	useEffect(() => {
		if (
			onPreview ||
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
	const currentPreview =
		previewCache.current?.key === `${previewContext}:${retry}` ? preview : null;
	const option = currentPreview?.options.find(
		(o) => o.planCode === planCode && o.billingPeriod === billingPeriod,
	);
	const displayed =
		validQuote?.quote ??
		(option && currentPreview
			? { ...option, firstChargeAt: currentPreview.firstChargeAt }
			: null);
	const card = currentPreview?.savedCard;
	const unchanged =
		enabled &&
		subscription.planCode === planCode &&
		subscription.price?.billingPeriod === billingPeriod;
	const confirm = (useSavedCard = true) => {
		if (!displayed) return;
		return onAction("confirm", {
			planCode,
			billingPeriod,
			amount: displayed.amount,
			currency: displayed.currency,
			firstChargeAt: displayed.firstChargeAt,
			...(useSavedCard && card ? { savedCardSourceId: card.sourceId } : {}),
		});
	};
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
					{!displayed ? (
						<div className="billing-renewal-unquoted">
							<p className="ac-muted" role="status">
								{previewLoading || busy
									? "Loading renewal terms…"
									: "Review the price and first payment date before continuing."}
							</p>
							{previewError && <p role="alert">{previewError}</p>}
							<button
								type="button"
								className="ac-button ac-button-primary"
								disabled={busy || previewLoading}
								onClick={() =>
									onPreview && active
										? setRetry((n) => n + 1)
										: void onAction("quote", { planCode, billingPeriod })
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
											currency: displayed.currency,
											maximumFractionDigits: 0,
										}).format(0)}
									</p>
									<p className="ac-muted">Your trial continues</p>
								</div>
								<div>
									<p className="billing-timeline-label">First payment</p>
									<p className="billing-timeline-amount">
										{formatMonthlyPrice({
											unitAmount: displayed.amount,
											currency: displayed.currency,
										})}
										<span> / {billingPeriodUnit(displayed.billingPeriod)}</span>
									</p>
									<p className="ac-muted">
										{formatBillingTime(displayed.firstChargeAt, timeZone)}
									</p>
								</div>
							</div>
							<p className="ac-muted">
								{card
									? "No payment today. Confirming enables "
									: "No payment today. Completing card setup enables "}
								{displayed.billingPeriod} automatic renewal after your trial.
								<br />
								Cancel before the first payment to avoid a charge.
							</p>
							{card && (
								<p className="ac-muted">
									Card: {card.brand.toUpperCase()} •••• {card.last4}
								</p>
							)}
							<p className="billing-tax-note">
								Taxes, discounts and credits may change the final total.
							</p>
							<div className="billing-actions">
								<button
									type="button"
									className="ac-button ac-button-primary"
									disabled={busy || (Boolean(preview) && unchanged)}
									onClick={() =>
										preview
											? void confirm()
											: validQuote &&
												void onAction("setup", {
													quoteId: validQuote.quote.id,
													requestId: validQuote.requestId,
												})
									}
								>
									{preview
										? card
											? unchanged
												? "Renewal is enabled"
												: enabled
													? "Save changes"
													: "Enable renewal"
											: "Add card & enable renewal"
										: enabled
											? "Confirm renewal changes"
											: "Add card & enable renewal"}
								</button>
								{card && (
									<button
										type="button"
										className="ac-button ac-button-quiet"
										disabled={busy}
										onClick={() => void confirm(false)}
									>
										Use a different card
									</button>
								)}
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
