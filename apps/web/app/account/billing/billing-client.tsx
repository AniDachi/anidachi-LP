"use client";

import {
	formatBillingTime,
	formatMonthlyPrice,
	billingPeriodUnit,
	type BillingSubscription,
	type BillingPeriod,
} from "@/lib/billing-view";
import type { TrialPlanQuote } from "@/lib/anidachi-auth/trial-plan-change";

import { ArrowRight, ChevronDown, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	BILLING_OWNER_HEADER,
	billingDisplayValidityMs,
	type BillingOverview,
	subscriptionDateLabel,
	subscriptionStatusLabel,
} from "@/lib/billing-view";
import { api } from "@/lib/client-api";
import { EXTENSION_USING_HASH } from "@/lib/extension-using-guide";
import { INSTALL_CTA_LABEL, INSTALL_HUB_PATH } from "@/lib/install-cta";

const PLAN_NAMES = { free: "Free", plus: "Plus", pro: "Pro" };

function subscriptionPriceLabel(
	subscription: BillingSubscription,
): string | null {
	const price = subscription.price ?? subscription.monthlyPrice;
	return price
		? `${formatMonthlyPrice(price)}/${billingPeriodUnit(subscription.price?.billingPeriod ?? "monthly")}`
		: null;
}

function formatDate(value: string | null) {
	if (!value || !Number.isFinite(Date.parse(value))) return "Date unavailable";
	return new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(
		new Date(value),
	);
}

export function BillingClient({
	ownerUserId,
	returnedFromPortal,
}: {
	ownerUserId: string;
	returnedFromPortal: boolean;
}) {
	const [overview, setOverview] = useState<BillingOverview | null>(null);
	const [busy, setBusy] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const version = useRef(0);
	const [planQuote, setPlanQuote] = useState<{
		subscriptionId: string;
		quote: TrialPlanQuote;
		requestId: string;
	} | null>(null);
	const actionLock = useRef(false);
	const displayTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);

	const load = useCallback(
		async (refresh: boolean) => {
			clearTimeout(displayTimer.current);
			const started = Date.now();
			const current = ++version.current;
			setBusy(true);
			setOverview(null);
			setPlanQuote(null);
			setError(null);
			setNotice(null);
			try {
				const result = await api<BillingOverview>(
					refresh ? "/api/billing/refresh" : "/api/billing/subscription",
					{
						method: refresh ? "POST" : "GET",
						headers: { [BILLING_OWNER_HEADER]: ownerUserId },
						...(refresh ? { body: "{}" } : {}),
						cache: "no-store",
						signal: AbortSignal.timeout(15_000),
					},
				);
				if (current !== version.current) return;
				if (result.ownerUserId !== ownerUserId)
					throw new Error("Your signed-in account changed. Reload this page.");
				const remaining =
					billingDisplayValidityMs(result) - (Date.now() - started);
				if (!(remaining > 0))
					throw new Error("Subscription status expired. Please refresh.");
				setOverview(result);
				displayTimer.current = setTimeout(() => void load(false), remaining);
				if (refresh) setNotice("Subscription status updated.");
			} catch (failure) {
				if (current !== version.current) return;
				setError(
					failure instanceof Error
						? failure.message
						: "Could not load your subscription. Please try again.",
				);
			} finally {
				if (current === version.current) setBusy(false);
			}
		},
		[ownerUserId],
	);

	useEffect(() => {
		void load(returnedFromPortal);
		const onFocus = () => void load(true);
		window.addEventListener("focus", onFocus);
		return () => {
			clearTimeout(displayTimer.current);
			version.current += 1;
			window.removeEventListener("focus", onFocus);
		};
	}, [load, returnedFromPortal]);

	async function changeTrial(
		subscriptionId: string,
		planCode: "plus" | "pro",
		confirm = false,
		billingPeriod?: BillingPeriod,
	) {
		if (actionLock.current) return;
		actionLock.current = true;
		const current = ++version.current;
		setBusy(true);
		setError(null);
		try {
			const result = await api<{ ownerUserId: string; quote?: TrialPlanQuote }>(
				"/api/billing/trial-plan",
				{
					method: "POST",
					headers: { [BILLING_OWNER_HEADER]: ownerUserId },
					body: JSON.stringify({
						action: confirm ? "confirm" : "quote",
						subscriptionId,
						planCode,
						billingPeriod: confirm
							? planQuote?.quote.billingPeriod
							: billingPeriod,
						...(confirm && planQuote
							? { quote: planQuote.quote, requestId: planQuote.requestId }
							: {}),
					}),
				},
			);
			if (current !== version.current) return;
			if (result.ownerUserId !== ownerUserId)
				throw new Error("Your signed-in account changed. Reload this page.");
			if (confirm) {
				setPlanQuote(null);
				await load(true);
			} else if (result.quote) {
				setPlanQuote({
					subscriptionId,
					quote: result.quote,
					requestId: crypto.randomUUID(),
				});
			} else
				throw new Error("Could not review the plan change. Please try again.");
		} catch (failure) {
			if (current === version.current) {
				setPlanQuote(null);
				setError(
					failure instanceof Error
						? failure.message
						: "Plan change unavailable. Please try again.",
				);
			}
		} finally {
			actionLock.current = false;
			if (current === version.current) setBusy(false);
		}
	}

	async function openStripe(
		subscriptionId: string,
		action: "cancel" | "payment" | "restore" | "yearly",
	) {
		if (actionLock.current) return;
		actionLock.current = true;
		const current = ++version.current;
		setBusy(true);
		setError(null);
		setNotice(null);
		try {
			const result = await api<{ url: string; ownerUserId: string }>(
				{
					payment: "/api/billing/payment-link",
					cancel: "/api/billing/cancellation-portal",
					restore: "/api/billing/renewal-portal",
					yearly: "/api/billing/yearly-portal",
				}[action],
				{
					method: "POST",
					headers: { [BILLING_OWNER_HEADER]: ownerUserId },
					body: JSON.stringify({ subscriptionId }),
				},
			);
			if (current !== version.current) return;
			if (result.ownerUserId !== ownerUserId)
				throw new Error("Your signed-in account changed. Reload this page.");
			window.location.assign(result.url);
		} catch (failure) {
			if (current !== version.current) return;
			setError(
				failure instanceof Error
					? failure.message
					: "Could not open Stripe. Please try again.",
			);
			setBusy(false);
		} finally {
			actionLock.current = false;
		}
	}

	return (
		<BillingView
			ownerUserId={ownerUserId}
			overview={overview}
			busy={busy}
			error={error}
			notice={notice}
			planQuote={planQuote}
			load={load}
			changeTrial={changeTrial}
			openStripe={openStripe}
			setPlanQuote={setPlanQuote}
		/>
	);
}

/** Presentation shared with the development-only preview; no requests or effects. */
export function BillingView({
	ownerUserId,
	overview,
	busy,
	error,
	notice,
	planQuote,
	load,
	changeTrial,
	openStripe,
	setPlanQuote,
}: {
	ownerUserId: string;
	overview: BillingOverview | null;
	busy: boolean;
	error: string | null;
	notice: string | null;
	planQuote: {
		subscriptionId: string;
		quote: TrialPlanQuote;
		requestId: string;
	} | null;
	load: (refresh: boolean) => Promise<void>;
	changeTrial: (
		subscriptionId: string,
		planCode: "plus" | "pro",
		confirm?: boolean,
		billingPeriod?: BillingPeriod,
	) => Promise<void>;
	openStripe: (
		subscriptionId: string,
		action: "cancel" | "payment" | "restore" | "yearly",
	) => Promise<void>;
	setPlanQuote: (quote: null) => void;
}) {
	const owned = overview?.ownerUserId === ownerUserId ? overview : null;
	const current =
		owned?.subscriptions.filter((s) => !isPastSubscription(s)) ?? [];
	const previous = owned?.subscriptions.filter(isPastSubscription) ?? [];
	return (
		<div className="ac-page ac-billing ac-billing-clean" aria-busy={busy}>
			<header className="billing-header">
				<h1>Subscription</h1>
				<button
					type="button"
					className="ac-button ac-button-quiet"
					onClick={() => void load(true)}
					disabled={busy}
				>
					<RefreshCw
						size={15}
						className={busy ? "ac-spinning" : ""}
						aria-hidden
					/>
					Refresh status
				</button>
			</header>
			{error && (
				<div role="alert" className="ac-notice ac-notice-error">
					<p>{error}</p>
					<a href="mailto:anidachi.app@gmail.com">Contact support</a>
				</div>
			)}
			{notice && (
				<p role="status" className="ac-notice">
					{notice}
				</p>
			)}
			{busy && !overview && (
				<p role="status" className="ac-loading">
					Loading your subscription…
				</p>
			)}
			{owned && (
				<>
					{(owned.planCode === "free" || current.length === 0) && (
						<section className="billing-access" aria-label="Current access">
							<h2>{PLAN_NAMES[owned.planCode]}</h2>
							{owned.planCode === "free" ? (
								<>
									<div className="billing-actions">
										<Link
											href={`${INSTALL_HUB_PATH}#${EXTENSION_USING_HASH}`}
											className="ac-button"
										>
											{INSTALL_CTA_LABEL}
										</Link>
										<Link
											href="/pricing"
											className="ac-button ac-button-primary"
										>
											View plans
											<ArrowRight size={16} aria-hidden />
										</Link>
									</div>
									<ul className="ac-plan-limits">
										{owned.hosting &&
										owned.serverTime &&
										owned.hosting.hostingActivationAt &&
										Date.parse(owned.hosting.hostingActivationAt) <=
											Date.parse(owned.serverTime) ? (
											<li>
												Join a Plus, Pro or trial host for free. Creating your
												own room needs Plus or Pro.
											</li>
										) : owned.hosting && owned.serverTime ? (
											<>
												<li>
													Host for 30 minutes a day once a guest joins. Waiting
													alone does not use that time, and pausing the video
													does not stop it. A warning appears with five minutes
													left.
												</li>
												<li>Up to 4 people in a room, including you.</li>
											</>
										) : (
											<li>
												Join friends for free. Refresh to check your current
												hosting access.
											</li>
										)}
										<li>
											No new watch history. You can still view and delete
											anything already saved.
										</li>
										<li>
											Invite by link. Push invites, room names, and more than
											one group need Plus or Pro.
										</li>
									</ul>
								</>
							) : (
								<p className="ac-muted">
									No recurring subscription is linked to this account.
								</p>
							)}
						</section>
					)}
					{current.map((subscription) => (
						<section
							key={subscription.id}
							className="billing-subscription"
							aria-label={`${PLAN_NAMES[subscription.planCode]} subscription`}
						>
							<div className="billing-plan-heading">
								<div>
									<div className="billing-plan-title">
										<h2>
											{PLAN_NAMES[subscription.planCode]}
											<span className="sr-only"> subscription</span>
										</h2>
										<span className="billing-status">
											{subscriptionStatusLabel(subscription)}
										</span>
									</div>
									{(subscription.price || subscription.monthlyPrice) && (
										<p>
											{subscription.price?.billingPeriod === "yearly"
												? "Yearly billing"
												: "Monthly billing"}
										</p>
									)}
								</div>
							</div>
							{subscription.planCode !== owned.planCode && (
								<p className="ac-muted">
									Current account access: {PLAN_NAMES[owned.planCode]}.
								</p>
							)}
							<SubscriptionFacts subscription={subscription} />
							{(["past_due", "unpaid", "incomplete"].includes(
								subscription.status,
							) ||
								subscription.trial?.stage === "payment_required" ||
								subscription.trial?.stage === "ended") &&
								!subscription.cancelAtPeriodEnd &&
								!isPastSubscription(subscription) && (
									<button
										type="button"
										className="ac-button ac-button-primary"
										disabled={busy}
										onClick={() => void openStripe(subscription.id, "payment")}
									>
										Complete payment in Stripe
										<ExternalLink size={15} aria-hidden />
									</button>
								)}
							<div className="billing-actions">
								{subscription.canSwitchToYearly &&
								subscription.planCode !== "free" ? (
									<div className="ac-renewal-action">
										<button
											className="ac-button"
											type="button"
											disabled={busy}
											onClick={() =>
												subscription.canChangeTrialPlan
													? void changeTrial(
															subscription.id,
															subscription.planCode as "plus" | "pro",
															false,
															"yearly",
														)
													: void openStripe(subscription.id, "yearly")
											}
										>
											Switch to yearly billing
										</button>
										<p className="ac-muted">
											{subscription.canChangeTrialPlan
												? "Keep your remaining trial days. Review the full yearly charge before confirming."
												: "Starts immediately. Stripe credits unused monthly time and shows the amount due before you confirm."}
										</p>
									</div>
								) : null}
								{subscription.canChangeTrialPlan ? (
									<div className="ac-renewal-action">
										<button
											className="ac-button"
											type="button"
											disabled={busy}
											onClick={() =>
												void changeTrial(
													subscription.id,
													subscription.planCode === "plus" ? "pro" : "plus",
												)
											}
										>
											Switch to{" "}
											{subscription.planCode === "plus" ? "Pro" : "Plus"}
										</button>
										{planQuote?.subscriptionId === subscription.id ? (
											<div
												className="ac-notice"
												role="region"
												aria-label="Review plan change"
											>
												<p>
													{PLAN_NAMES[planQuote.quote.planCode]}:{" "}
													{formatMonthlyPrice(planQuote.quote)}/
													{billingPeriodUnit(
														planQuote.quote.billingPeriod ?? "monthly",
													)}{" "}
													after your trial. Taxes, discounts and credits may
													change the final total.
												</p>
												<p>
													Your trial still ends{" "}
													{formatBillingTime(planQuote.quote.trialEndsAt)}. No
													extra trial days.{" "}
													{planQuote.quote.renewalCanceled
														? "Your renewal stays canceled."
														: "Your subscription renews automatically after the trial."}
												</p>
												<button
													type="button"
													className="ac-button ac-button-primary"
													disabled={busy}
													onClick={() =>
														void changeTrial(
															subscription.id,
															planQuote.quote.planCode,
															true,
														)
													}
												>
													Confirm plan change
												</button>
												<button
													type="button"
													className="ac-button"
													disabled={busy}
													onClick={() => setPlanQuote(null)}
												>
													Keep current plan
												</button>
											</div>
										) : null}
									</div>
								) : null}
								{subscription.canCancel ? (
									<div className="ac-renewal-action">
										<button
											type="button"
											disabled={busy}
											onClick={() => void openStripe(subscription.id, "cancel")}
											className="ac-button"
										>
											Cancel renewal <ExternalLink size={15} aria-hidden />
										</button>
									</div>
								) : null}
								{subscription.canRestoreRenewal ? (
									<div className="ac-renewal-action">
										<button
											type="button"
											className="ac-button"
											disabled={busy}
											onClick={() =>
												void openStripe(subscription.id, "restore")
											}
										>
											Restore renewal <ExternalLink size={15} aria-hidden />
										</button>
									</div>
								) : null}
							</div>
							{(subscription.canCancel || subscription.canRestoreRenewal) && (
								<p className="billing-action-note">
									{subscription.canCancel
										? subscription.trial?.stage === "trial"
											? "Cancel before your trial ends to avoid a charge. Access stays until then."
											: subscription.status === "active" &&
													(!subscription.trial || subscription.trial.stage === "paid")
												? "Cancel renewal in Stripe. Access stays until the end of your paid period."
												: "Confirm cancellation in Stripe to stop future renewals."
										: "Restore renewal in Stripe. Your current end date stays the same."}
								</p>
							)}
						</section>
					))}
					{previous.length > 0 && (
						<details className="billing-history">
							<summary>
								Subscription history{" "}
								<span>
									{previous.length}
									<ChevronDown size={16} aria-hidden />
								</span>
							</summary>
							<div className="billing-history-list">
								{previous.map((subscription) => (
									<div key={subscription.id} className="billing-history-row">
										<div>
											<h3>{PLAN_NAMES[subscription.planCode]} subscription</h3>
											<p>
												{subscriptionPriceLabel(subscription) ??
													"Price unavailable"}
											</p>
										</div>
										<span>{subscriptionStatusLabel(subscription)}</span>
									</div>
								))}
							</div>
						</details>
					)}
					<footer className="billing-footer">
						<Link href="/pricing">
							Compare plans
							<ArrowRight size={15} aria-hidden />
						</Link>
						<a href="mailto:anidachi.app@gmail.com">
							Contact support
							<ArrowRight size={15} aria-hidden />
						</a>
					</footer>
				</>
			)}
		</div>
	);
}

function isPastSubscription(subscription: BillingSubscription) {
	return (
		subscription.status === "canceled" ||
		subscription.status === "incomplete_expired"
	);
}

function SubscriptionFacts({
	subscription,
}: {
	subscription: BillingSubscription;
}) {
	const trial = subscription.trial;
	const inTrial = trial?.stage === "trial";
	const price = subscriptionPriceLabel(subscription);
	const paymentPeriod =
		subscription.price?.billingPeriod ??
		(subscription.monthlyPrice ? "monthly" : "subscription");
	const priceTitle =
		inTrial && !subscription.cancelAtPeriodEnd
			? `First ${paymentPeriod} payment`
			: "Plan price";
	return (
		<>
			<dl className="billing-facts">
				<div>
					<dt>
						{inTrial ? "Trial ends" : subscriptionDateLabel(subscription)}
					</dt>
					<dd>
						{inTrial
							? formatBillingTime(trial.endsAt)
							: formatDate(subscription.currentPeriodEnd)}
					</dd>
					{inTrial && <dd className="billing-timezone">Your local time</dd>}
				</div>
				<div>
					<dt>{priceTitle}</dt>
					<dd>{price ?? "Amount unavailable"}</dd>
				</div>
			</dl>
			<div className="billing-terms">
				{inTrial && (
					<p>
						{subscription.cancelAtPeriodEnd
							? "No payment scheduled. Access continues until your trial ends."
							: "Renews automatically after your trial."}
					</p>
				)}
				{!inTrial && subscription.cancelAtPeriodEnd && (
					<p>Renewal is canceled. Access continues until the date shown.</p>
				)}
				{!trial &&
					subscription.status === "active" &&
					!subscription.cancelAtPeriodEnd && (
						<p>Renews automatically.</p>
					)}
				{trial?.stage === "paid" &&
					subscription.status === "active" &&
					!subscription.cancelAtPeriodEnd && (
						<p>Renews automatically.</p>
					)}
				{trial?.stage === "processing" && (
					<p className="billing-warning">
						Your first payment is being confirmed. This is not yet a paid
						period. Temporary access lasts at most until{" "}
						{formatBillingTime(trial.pendingUntil)} (your local time).
					</p>
				)}
				{trial?.stage === "payment_required" && (
					<p className="billing-warning">
						Your first payment needs attention. Complete payment to restore this
						subscription’s paid access.
					</p>
				)}
				{trial?.stage === "ended" && (
					<p className="billing-warning">
						Your trial has ended. Check your current account access before
						creating a room.
					</p>
				)}
				{["past_due", "unpaid"].includes(subscription.status) &&
					trial?.stage !== "payment_required" && (
						<p className="billing-warning">
							Your payment needs attention. Paid features may be unavailable;
							contact support if you need help.
						</p>
					)}
				{price && (
					<p className="billing-tax-note">
						Taxes, discounts and credits may change the final total.
					</p>
				)}
			</div>
		</>
	);
}
