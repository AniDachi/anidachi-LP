"use client";

import { ArrowRight, CreditCard, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	BILLING_OWNER_HEADER,
	type BillingOverview,
	subscriptionDateLabel,
	subscriptionStatusLabel,
} from "@/lib/billing-view";
import { AccountPageHeader } from "@/components/account/account-ui";
import { api } from "@/lib/client-api";

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

	const load = useCallback(
		async (refresh: boolean) => {
			const current = ++version.current;
			setBusy(true);
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
					},
				);
				if (current !== version.current) return;
				if (result.ownerUserId !== ownerUserId)
					throw new Error("Your signed-in account changed. Reload this page.");
				setOverview(result);
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
		return () => {
			version.current += 1;
		};
	}, [load, returnedFromPortal]);

	async function cancel(subscriptionId: string) {
		const current = ++version.current;
		setBusy(true);
		setError(null);
		setNotice(null);
		try {
			const result = await api<{ url: string; ownerUserId: string }>(
				"/api/billing/cancellation-portal",
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
					: "Could not open cancellation. Please try again.",
			);
			setBusy(false);
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
			{overview ? (
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
								<Link href="/pricing" className="ac-button ac-button-primary">
									View plans <ArrowRight size={16} aria-hidden />
								</Link>
							) : null}
						</div>
						{overview.subscriptions.length === 0 ? (
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
								{subscription.canCancel ? (
									<div className="ac-renewal-action">
										<p>
											Confirm cancellation securely with Stripe. Canceling stops
											renewal; any remaining paid access continues until the end
											of your billing period.
										</p>
										<button
											type="button"
											disabled={busy}
											onClick={() => void cancel(subscription.id)}
											className="ac-button"
										>
											Cancel subscription <ExternalLink size={15} aria-hidden />
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
