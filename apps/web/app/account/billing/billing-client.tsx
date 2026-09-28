"use client";

import { formatBillingTime, formatMonthlyPrice } from "@/lib/billing-view";
import type { TrialPlanQuote } from "@/lib/anidachi-auth/trial-plan-change";

import { ArrowRight, CreditCard, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	BILLING_OWNER_HEADER,
	billingDisplayValidityMs,
	type BillingOverview,
	subscriptionDateLabel,
	subscriptionStatusLabel,
} from "@/lib/billing-view";
import { AccountPageHeader } from "@/components/account/account-ui";
import { api } from "@/lib/client-api";
import { EXTENSION_USING_HASH } from "@/lib/extension-using-guide";
import { INSTALL_CTA_LABEL, INSTALL_HUB_PATH } from "@/lib/install-cta";

const PLAN_NAMES = { free: "Free", plus: "Plus", pro: "Pro" };

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
		action: "cancel" | "payment" | "restore",
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
		<div className="ac-page ac-billing" aria-busy={busy}>
			<AccountPageHeader
				title="Subscription"
				description="Your plan, billing status, and renewal settings."
				action={
					<button
						type="button"
						className="ac-button ac-button-quiet"
						onClick={() => void load(true)}
						disabled={busy}
					>
						<RefreshCw
							size={16}
							className={busy ? "ac-spinning" : ""}
							aria-hidden
						/>
						Refresh status
					</button>
				}
			/>
			{error ? (
				<div role="alert" className="ac-notice ac-notice-error">
					<p>{error}</p>
					<a href="mailto:anidachi.app@gmail.com">Contact support</a>
				</div>
			) : null}
			{notice ? (
				<p role="status" className="ac-notice">
					{notice}
				</p>
			) : null}
			{busy && !overview ? (
				<p role="status" className="ac-loading">
					Loading your subscription…
				</p>
			) : null}
			{overview?.ownerUserId === ownerUserId ? (
				<div className="ac-detail-layout">
					<div className="ac-plan-panel">
						<div className="ac-plan-heading">
							<div>
								<p className="ac-eyebrow">
									<CreditCard size={16} aria-hidden />
									CURRENT PLAN
								</p>
								<h2>
									AniDachi <span>{PLAN_NAMES[overview.planCode]}</span>
								</h2>
							</div>
							{overview.planCode === "free" ? (
								<div className="ac-plan-actions">
									<Link
										href={`${INSTALL_HUB_PATH}#${EXTENSION_USING_HASH}`}
										className="ac-button ac-button-primary"
									>
										{INSTALL_CTA_LABEL}
									</Link>
									<Link href="/pricing" className="ac-button">
										View plans <ArrowRight size={16} aria-hidden />
									</Link>
								</div>
							) : null}
						</div>
						{overview.planCode === "free" ? (
							<ul className="ac-plan-limits">
								{overview.hosting &&
								overview.serverTime &&
								overview.hosting.hostingActivationAt &&
								Date.parse(overview.hosting.hostingActivationAt) <=
									Date.parse(overview.serverTime) ? (
									<li>
										Join a Plus, Pro or trial host for free. Creating your own
										room needs Plus or Pro.
									</li>
								) : overview.hosting && overview.serverTime ? (
									<>
										<li>
											Host for 30 minutes a day once a guest joins. Waiting
											alone does not use that time, and pausing the video does
											not stop it. A warning appears with five minutes left.
										</li>
										<li>Up to 4 people in a room, including you.</li>
									</>
								) : (
									<li>
										Join friends for free. Refresh to check your current hosting
										access.
									</li>
								)}
								<li>
									No new watch history. You can still view and delete anything
									already saved.
								</li>
								<li>
									Invite by link. Push invites, room names, and more than one
									group need Plus or Pro.
								</li>
							</ul>
						) : overview.subscriptions.length === 0 ? (
							<p className="ac-plan-empty">
								No recurring subscription is linked to this account.
							</p>
						) : null}
						{overview.subscriptions.map((subscription) => (
							<section
								key={subscription.id}
								className="ac-subscription-record"
								aria-label={`${PLAN_NAMES[subscription.planCode]} subscription`}
							>
								<div className="ac-section-heading">
									<h3>{PLAN_NAMES[subscription.planCode]} subscription</h3>
									<span className="ac-status">
										{subscriptionStatusLabel(subscription)}
									</span>
								</div>
								{subscription.trial ? (
									<div className="ac-notice">
										<p>
											Trial ends: {formatBillingTime(subscription.trial.endsAt)}{" "}
											(your local time).
										</p>
										{subscription.trial.stage === "trial" ? (
											<p>
												{subscription.cancelAtPeriodEnd
													? "Renewal is canceled. Access continues until this trial ends; no first subscription charge is scheduled."
													: `Your first monthly payment is scheduled after the trial ends${subscription.monthlyPrice ? ` at ${formatMonthlyPrice(subscription.monthlyPrice)}/month` : ""}. Cancel renewal before then to avoid that charge.`}
											</p>
										) : null}
										{subscription.trial.stage === "processing" ? (
											<p>
												Your first payment is being confirmed. This is not yet a
												paid month. Temporary access lasts at most until{" "}
												{formatBillingTime(subscription.trial.pendingUntil)}.
											</p>
										) : null}
										{subscription.trial.stage === "payment_required" ? (
											<p>
												Your first payment needs attention. Complete payment to
												restore this subscription’s paid access.
											</p>
										) : null}
										{subscription.trial.stage === "ended" ? (
											<p>
												Your trial has ended. Check the current access shown
												above before creating a room.
											</p>
										) : null}
									</div>
								) : null}
								{subscription.monthlyPrice ? (
									<p className="ac-muted">
										{formatMonthlyPrice(subscription.monthlyPrice)}/month.
										Taxes, discounts and credits may change the final invoice
										total.
									</p>
								) : null}
								{(["past_due", "unpaid", "incomplete"].includes(
									subscription.status,
								) ||
									subscription.trial?.stage === "payment_required" ||
									subscription.trial?.stage === "ended") &&
								!subscription.cancelAtPeriodEnd &&
								!["canceled", "incomplete_expired"].includes(
									subscription.status,
								) ? (
									<button
										type="button"
										className="ac-button"
										disabled={busy}
										onClick={() => void openStripe(subscription.id, "payment")}
									>
										Complete payment in Stripe{" "}
										<ExternalLink size={15} aria-hidden />
									</button>
								) : null}
								{subscription.status !== "canceled" &&
								subscription.status !== "incomplete_expired" ? (
									<dl className="ac-billing-date">
										<div>
											<dt>{subscriptionDateLabel(subscription)}</dt>
											<dd>{formatDate(subscription.currentPeriodEnd)}</dd>
										</div>
									</dl>
								) : null}
								{subscription.cancelAtPeriodEnd &&
								subscription.status !== "canceled" ? (
									<p className="ac-muted">
										Renewal is canceled. Your subscription will end
										automatically on the date shown.
									</p>
								) : null}
								{subscription.status === "past_due" ||
								subscription.status === "unpaid" ? (
									<p className="ac-notice ac-notice-error">
										Your payment needs attention. Paid features may be
										unavailable; contact support if you need help.
									</p>
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
													{formatMonthlyPrice(planQuote.quote)}/month after your
													trial. Taxes, discounts and credits may change the
													final total.
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
										<p>
											Confirm cancellation securely with Stripe. Renewal stops;
											access continues until the end of your current trial or
											paid period.
										</p>
										<button
											type="button"
											disabled={busy}
											onClick={() => void openStripe(subscription.id, "cancel")}
											className="ac-button"
										>
											Cancel subscription <ExternalLink size={15} aria-hidden />
										</button>
									</div>
								) : null}
								{subscription.canRestoreRenewal ? (
									<div className="ac-renewal-action">
										<p>
											Confirm renewal in Stripe before the end date shown. Your
											current trial or paid period keeps its original end date;
											future payments resume automatically. No extra trial days.
										</p>
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
							</section>
						))}
					</div>
					<aside className="ac-context" aria-label="Subscription help">
						<h2>Make it yours</h2>
						<p>Compare the available plans and choose what works for you.</p>
						<Link href="/pricing" className="ac-text-link">
							Compare plans <ArrowRight size={15} aria-hidden />
						</Link>
						<div className="ac-context-section">
							<h2>Your history stays</h2>
							<p>
								On Free, you can view and delete saved history. Recording and
								editing progress need Plus or Pro.
							</p>
							<Link href="/account/watch-library" className="ac-text-link">
								Open watch library <ArrowRight size={15} aria-hidden />
							</Link>
						</div>
						<div className="ac-context-section">
							<h2>Need a hand?</h2>
							<a className="ac-text-link" href="mailto:anidachi.app@gmail.com">
								Contact support <ArrowRight size={15} aria-hidden />
							</a>
						</div>
					</aside>
				</div>
			) : null}
		</div>
	);
}
