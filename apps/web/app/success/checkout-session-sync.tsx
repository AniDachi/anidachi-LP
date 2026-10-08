"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	AlertCircle,
	ArrowRight,
	Check,
	CreditCard,
	Loader2,
} from "lucide-react";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { Button } from "@/components/ui/button";
import styles from "./success.module.css";
import {
	type BillingOverview,
	type BillingSubscription,
	formatBillingTime,
	billingDisplayValidityMs,
} from "@/lib/billing-view";

export type SyncState = {
	status: "syncing" | "synced" | "error" | "missing" | "inactive";
	message: string;
	heading?: string;
	trialActive?: boolean;
};

const PLAN_LABELS: Record<string, string> = {
	free: "Free",
	plus: "Plus",
	pro: "Pro",
};

export function CheckoutSessionSync({
	sessionId,
	initialPlanCode,
	children,
	ownerUserId,
}: {
	sessionId?: string;
	initialPlanCode: string;
	children?: ReactNode;
	ownerUserId?: string;
}) {
	const router = useRouter();
	const [retry, setRetry] = useState(0);
	const [state, setState] = useState<SyncState>({
		status: sessionId ? "syncing" : "missing",
		message: sessionId
			? "Confirming your subscription with Stripe..."
			: `Your current AniDachi plan is ${PLAN_LABELS[initialPlanCode] ?? initialPlanCode}.`,
	});

	useEffect(() => {
		if (!sessionId) return;

		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const onFocus = () => setRetry((n) => n + 1);
		window.addEventListener("focus", onFocus);
		async function sync() {
			const started = Date.now();
			setState({
				status: "syncing",
				message: "Confirming your subscription with Stripe...",
			});
			try {
				const response = await fetch("/api/billing/sync-checkout-session", {
					signal: AbortSignal.timeout(15_000),
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						sessionId,
						next: "/account",
						...(ownerUserId ? { expectedOwnerUserId: ownerUserId } : {}),
					}),
				});
				const payload = (await response.json().catch(() => null)) as {
					ok?: boolean;
					planCode?: string;
					error?: string;
					billing?: BillingOverview;
					checkoutSubscription?: BillingSubscription;
				} | null;
				if (cancelled) return;
				if (
					ownerUserId &&
					payload?.billing &&
					payload.billing.ownerUserId !== ownerUserId
				)
					throw new Error("Account changed");

				if (
					!response.ok ||
					!payload?.ok ||
					!["free", "plus", "pro"].includes(payload.planCode ?? "")
				) {
					setState({
						status: "error",
						message:
							payload?.error ??
							"We could not verify your subscription. Refresh this page or check Account → Subscription.",
					});
					return;
				}

				const planLabel = PLAN_LABELS[payload.planCode ?? ""];
				const checkoutPlanLabel =
					PLAN_LABELS[payload.checkoutSubscription?.planCode ?? ""] ??
					planLabel;
				const validity = payload.billing
					? billingDisplayValidityMs({
							...payload.billing,
							subscriptions: [
								...payload.billing.subscriptions,
								...(payload.checkoutSubscription
									? [payload.checkoutSubscription]
									: []),
							],
						})
					: 60_000;
				const remaining = validity - (Date.now() - started);
				if (!(remaining > 0)) throw new Error("Subscription status expired");
				timer = setTimeout(onFocus, remaining);
				const trial = payload.checkoutSubscription?.trial;
				if (trial && trial.stage !== "paid") {
					const headings = {
						trial: "Your free trial has started",
						processing: "First payment processing",
						payment_required: "Payment needs attention",
						ended: "Your trial has ended",
					};
					setState({
						status: trial.stage === "trial" ? "synced" : "inactive",
						heading: headings[trial.stage],
						trialActive: trial.stage === "trial",
						message:
							trial.stage === "trial"
								? `Your ${checkoutPlanLabel} trial ends ${formatBillingTime(trial.endsAt)} (your local time).`
								: trial.stage === "processing"
									? "We are waiting for your first payment to be confirmed. Check Account → Subscription for the current access and payment status."
									: trial.stage === "payment_required"
										? "Complete your payment in Account → Subscription to restore paid access."
										: "Open Account → Subscription to see your current access and payment options.",
					});
					router.refresh();
					return;
				}
				const hasPaidAccess =
					payload.planCode === "plus" || payload.planCode === "pro";
				setState({
					status: hasPaidAccess ? "synced" : "inactive",
					message: hasPaidAccess
						? `Your AniDachi account is active on ${planLabel}.`
						: "Your current AniDachi plan is Free. Check Account → Subscription for details.",
				});
				router.refresh();
			} catch {
				if (!cancelled) {
					setState({
						status: "error",
						message:
							"Network error while confirming your subscription. Refresh this page or open Account in a minute.",
					});
				}
			}
		}

		sync();
		return () => {
			clearTimeout(timer);
			window.removeEventListener("focus", onFocus);
			cancelled = true;
		};
	}, [router, sessionId, ownerUserId, retry]);

	return (
		<CheckoutSessionStatus
			state={state}
			onRetry={sessionId ? () => setRetry((n) => n + 1) : undefined}
		>
			{children}
		</CheckoutSessionStatus>
	);
}

/** Presentation only: this component neither verifies nor grants account access. */
export function CheckoutSessionStatus({
	state,
	children,
	onRetry,
}: {
	state: SyncState;
	children?: ReactNode;
	onRetry?: () => void;
}) {
	const isSynced = state.status === "synced";
	const isError = state.status === "error";
	const isSyncing = state.status === "syncing";
	const StatusIcon = isSynced
		? Check
		: isError
			? AlertCircle
			: isSyncing
				? Loader2
				: CreditCard;
	const title =
		state.heading ??
		(isSynced
			? "Subscription confirmed"
			: isError
				? "Could not confirm your subscription"
				: isSyncing
					? "Checking your subscription"
					: state.status === "missing"
						? "Your subscription"
						: "Subscription status");
	return (
		<>
			<header className={styles.header}>
				<div className={styles.mark}>
					<AnidachiLogo size={56} priority />
					<span
						className={`${styles.statusMark} ${isError ? styles.error : ""}`}
					>
						<StatusIcon
							className={
								isSyncing
									? "h-4 w-4 animate-spin motion-reduce:animate-none"
									: "h-4 w-4"
							}
							aria-hidden="true"
						/>
					</span>
				</div>
				<h1 className={styles.title}>{title}</h1>
				<div
					role={isError ? "alert" : "status"}
					aria-live={isError ? "assertive" : "polite"}
					className={`${styles.message} ${isError ? styles.error : ""}`}
				>
					<p>{state.message}</p>
				</div>
			</header>

			<div className={styles.actions}>
				{isError && onRetry ? (
					<Button
						variant="cream"
						size="touch"
						className={styles.primary}
						onClick={onRetry}
					>
						Try again <ArrowRight aria-hidden="true" />
					</Button>
				) : null}
				<Button
					asChild
					variant={isError && onRetry ? "outline" : "cream"}
					size="touch"
					className={styles.primary}
				>
					<Link href="/account">
						Open account <ArrowRight aria-hidden="true" />
					</Link>
				</Button>
				{isSynced ? (
					<Link href="/extension" className={styles.secondary}>
						Download for Chrome
					</Link>
				) : null}
			</div>

			{isSynced ? (
				<p className={styles.nextStep}>
					Ready to watch? Open Crunchyroll, YouTube or Netflix and create a room from the
					AniDachi extension.
				</p>
			) : null}
			{isSynced && state.trialActive ? (
				<p className={styles.trialNote}>
					View renewal details or cancel your trial in{" "}
					<Link href="/account/billing">your subscription settings</Link>.
				</p>
			) : null}
			{!isError && !isSyncing && !isSynced && onRetry ? (
				<button type="button" onClick={onRetry} className={styles.secondary}>
					Check status again
				</button>
			) : null}
			{children}
		</>
	);
}
