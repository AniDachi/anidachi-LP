"use client";

import { CreditCard, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	BILLING_OWNER_HEADER,
	type BillingOverview,
	subscriptionDateLabel,
	subscriptionStatusLabel,
} from "@/lib/billing-view";
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
		<div className="flex flex-col gap-5" aria-busy={busy}>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
						Subscription
					</h2>
					<p className="mt-1 text-sm text-foreground/60">
						View your plan and manage renewal.
					</p>
				</div>
				<button
					type="button"
					onClick={() => void load(true)}
					disabled={busy}
					className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-border px-4 text-sm font-semibold text-foreground/80 hover:bg-brand-surface disabled:opacity-50"
				>
					<RefreshCw
						className={`h-4 w-4 ${busy ? "animate-spin" : ""}`}
						aria-hidden
					/>
					Refresh status
				</button>
			</div>

			{error ? (
				<div
					role="alert"
					className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-foreground"
				>
					<p>{error}</p>
					<a
						className="mt-2 inline-block text-brand-orange underline underline-offset-4"
						href="mailto:anidachi.app@gmail.com"
					>
						Contact support
					</a>
				</div>
			) : null}
			{notice ? (
				<p role="status" className="text-sm text-foreground/70">
					{notice}
				</p>
			) : null}
			{busy && !overview ? (
				<p role="status" className="text-sm text-foreground/60">
					Loading your subscription…
				</p>
			) : null}

			{overview ? (
				<>
					<section className="rounded-2xl border border-brand-border/80 bg-brand-surface p-5 sm:p-6">
						<div className="flex items-center gap-3">
							<CreditCard className="h-5 w-5 text-brand-orange" aria-hidden />
							<p className="text-sm text-foreground/60">Current plan</p>
						</div>
						<p className="mt-3 text-2xl font-semibold text-foreground">
							{PLAN_NAMES[overview.planCode]}
						</p>
						{overview.subscriptions.length === 0 ? (
							<p className="mt-2 text-sm text-foreground/60">
								No recurring subscription is linked to this account.
							</p>
						) : null}
						{overview.planCode === "free" ? (
							<Link
								href="/pricing"
								className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand-orange px-4 text-sm font-semibold text-primary-foreground hover:bg-brand-orange-deep"
							>
								View plans
							</Link>
						) : null}
					</section>

					{overview.subscriptions.map((subscription) => (
						<section
							key={subscription.id}
							className="rounded-2xl border border-brand-border/80 bg-brand-surface p-5 sm:p-6"
						>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<h3 className="text-lg font-semibold text-foreground">
									{PLAN_NAMES[subscription.planCode]} subscription
								</h3>
								<span className="rounded-full border border-brand-border px-3 py-1 text-xs font-medium text-foreground/80">
									{subscriptionStatusLabel(subscription)}
								</span>
							</div>
							{subscription.status !== "canceled" &&
							subscription.status !== "incomplete_expired" ? (
								<p className="mt-3 text-sm text-foreground/70">
									{subscriptionDateLabel(subscription)}:{" "}
									<span className="font-medium text-foreground">
										{formatDate(subscription.currentPeriodEnd)}
									</span>
								</p>
							) : null}
							{subscription.cancelAtPeriodEnd &&
							subscription.status !== "canceled" ? (
								<p className="mt-2 text-sm text-foreground/60">
									Renewal is canceled. Your subscription will end automatically
									on the date shown.
								</p>
							) : null}
							{subscription.status === "past_due" ||
							subscription.status === "unpaid" ? (
								<p className="mt-2 text-sm text-foreground/60">
									Your payment needs attention. Paid features may be
									unavailable; contact support if you need help.
								</p>
							) : null}
							{subscription.canCancel ? (
								<div className="mt-5 border-t border-brand-border/70 pt-4">
									<p className="mb-3 max-w-xl text-sm text-foreground/60">
										Confirm cancellation securely with Stripe. Canceling stops
										renewal; any remaining paid access continues until the end
										of your billing period.
									</p>
									<button
										type="button"
										disabled={busy}
										onClick={() => void cancel(subscription.id)}
										className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-border px-4 text-sm font-semibold text-foreground hover:border-brand-orange/60 hover:bg-brand-orange/10 disabled:opacity-50"
									>
										Cancel subscription{" "}
										<ExternalLink className="h-4 w-4" aria-hidden />
									</button>
								</div>
							) : null}
						</section>
					))}
				</>
			) : null}
		</div>
	);
}
