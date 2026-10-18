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
import { serverSnapshotRemainingMs } from "@/lib/server-snapshot-age";
import {
	BillingOwnerChangedError,
	guardBillingNavigation,
} from "@/lib/billing-navigation";
import { takeAccountPreload } from "@/lib/account-navigation-preload";
import { api, ApiError } from "@/lib/client-api";
import { EXTENSION_USING_HASH } from "@/lib/extension-using-guide";
import { INSTALL_CTA_LABEL, INSTALL_HUB_PATH } from "@/lib/install-cta";
import { InstallLink } from "@/components/install-link";
import { checkoutReturnPath } from "@/lib/checkout-selection";
import {
	postTrialAction,
	secureTrialSetupUrl,
	trialResultMessage,
} from "@/lib/trial-client";
import type {
	RenewalSetupResult,
	TrialRenewalQuote,
	TrialRenewalPreview,
} from "@/lib/anidachi-auth/trial-renewal";
import {
	CardlessTrialControls,
	type CardlessQuoteView,
	type CardlessRenewalAction,
	type CardlessRenewalSelection,
} from "./cardless-trial-controls";
import type { ReactNode } from "react";

import {
	SubscriptionPresentation,
	hasSubscriptionSummary,
	EndedTrialSummary,
} from "./subscription-summary";

import { useBillingTimeZone } from "./use-billing-time-zone";

const PLAN_NAMES = { free: "Free", plus: "Plus", pro: "Pro" };

// Retain reviewed terms only while the same verified subscription is unchanged.
function cardlessRenewalContext(subscription: BillingSubscription): string {
	return JSON.stringify([
		subscription.id,
		subscription.planCode,
		subscription.status,
		subscription.cancelAtPeriodEnd,
		subscription.price?.unitAmount,
		subscription.price?.currency,
		subscription.price?.billingPeriod,
		subscription.trial?.mode,
		subscription.trial?.stage,
		subscription.trial?.endsAt,
		subscription.trial?.renewalState,
		subscription.trial?.renewalEnabled,
		subscription.trial?.pendingRenewal?.id,
	]);
}

function subscriptionPriceLabel(
	subscription: BillingSubscription,
): string | null {
	const price = subscription.price ?? subscription.monthlyPrice;
	return price
		? `${formatMonthlyPrice(price)}/${billingPeriodUnit(subscription.price?.billingPeriod ?? "monthly")}`
		: null;
}

function formatDate(value: string | null, timeZone: string) {
	if (!value || !Number.isFinite(Date.parse(value))) return "Date unavailable";
	return new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone }).format(
		new Date(value),
	);
}

type BillingClientProps = {
	ownerUserId: string;
	returnedFromPortal: boolean;
	manageRequested?: boolean;
	initial?: { overview: BillingOverview; remainingMs: number };
	trialSetupReturn?: { operationId: string; canceled: boolean };
};
export function BillingClient(props: BillingClientProps) {
	return <BillingWorkspace key={props.ownerUserId} {...props} />;
}
function BillingWorkspace({
	ownerUserId,
	returnedFromPortal,
	initial,
	trialSetupReturn,
	manageRequested = false,
}: BillingClientProps) {
	const [snapshot] = useState(() =>
		!returnedFromPortal && initial?.overview.ownerUserId === ownerUserId
			? initial
			: undefined,
	);
	const [overview, setOverview] = useState<BillingOverview | null>(
		snapshot?.overview ?? null,
	);
	const [busy, setBusy] = useState(!snapshot);
	const [trialBusy, setTrialBusy] = useState(false);
	const [renewalPreviewRevision, setRenewalPreviewRevision] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const version = useRef(0);
	const departures = useRef(0);
	const lifetime = useRef<AbortController | null>(null);
	const pendingRead = useRef<{
		version: number;
		departure: number;
		promise: Promise<boolean>;
	} | null>(null);
	const validUntil = useRef(0);
	const [planQuote, setPlanQuote] = useState<{
		subscriptionId: string;
		quote: TrialPlanQuote;
		requestId: string;
	} | null>(null);
	const actionLock = useRef(false);
	// Draft choices belong to this owner-keyed workspace, not the expiring display.
	const [renewalSelections, setRenewalSelections] = useState<
		Record<string, CardlessRenewalSelection>
	>({});
	const [renewalQuote, setRenewalQuote] = useState<
		| (CardlessQuoteView & {
				subscriptionId: string;
				context: string;
				expiresAtLocal: number;
		  })
		| null
	>(null);
	const serverClock = useRef({ time: Number.NaN, receivedAt: 0 });
	const trialAbort = useRef<AbortController | null>(null);
	const cancelRequestId = useRef<string | null>(null);
	const displayTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);

	const load = useCallback(
		(
			refresh: boolean,
			useNavigationRequest = false,
			afterMutation = false,
		): Promise<boolean> => {
			if (
				!refresh &&
				pendingRead.current?.version === version.current &&
				pendingRead.current.departure === departures.current
			)
				return pendingRead.current.promise;
			const departure = departures.current;
			const promise = (async () => {
				const pending =
					!refresh && useNavigationRequest
						? takeAccountPreload(ownerUserId, "/api/billing/subscription")
						: null;
				const started = pending?.started ?? Date.now();
				const current = ++version.current;
				setBusy(true);
				setPlanQuote(null);
				setError(null);
				setNotice(null);
				try {
					const result = await (pending
						? (pending.response as Promise<BillingOverview>)
						: api<BillingOverview>(
								refresh ? "/api/billing/refresh" : "/api/billing/subscription",
								{
									method: refresh ? "POST" : "GET",
									headers: { [BILLING_OWNER_HEADER]: ownerUserId },
									...(refresh ? { body: "{}" } : {}),
									cache: "no-store",
									signal: AbortSignal.timeout(15_000),
								},
							));
					if (current !== version.current) return false;
					if (departure !== departures.current) {
						if (!actionLock.current) return false;
						await guardBillingNavigation(
							ownerUserId,
							lifetime.current!.signal,
							true,
							() => departures.current,
						);
						if (current !== version.current) return false;
					}
					if (result.ownerUserId !== ownerUserId)
						throw new ApiError(
							"Your signed-in account changed. Reload this page.",
							"ACCOUNT_CHANGED",
							409,
						);
					const remaining =
						billingDisplayValidityMs(result) - (Date.now() - started);
					if (!(remaining > 0))
						throw new Error("Subscription status expired. Please refresh.");
					const receivedAt = Date.now();
					const serverNow =
						Date.parse(result.serverTime ?? "") + (receivedAt - started);
					serverClock.current = { time: serverNow, receivedAt };
					setRenewalSelections((previous) =>
						Object.fromEntries(
							result.subscriptions
								.filter(
									(s) =>
										s.trial?.mode === "cardless" &&
										s.trial.stage === "trial" &&
										previous[s.id],
								)
								.map((s) => [s.id, previous[s.id]]),
						),
					);
					setRenewalQuote((previous) => {
						if (!previous) return null;
						const subscription = result.subscriptions.find(
							(s) => s.id === previous.subscriptionId,
						);
						return subscription?.trial?.mode === "cardless" &&
							subscription.trial.stage === "trial" &&
							!subscription.trial.pendingRenewal &&
							subscription.trial.renewalQuoteId === previous.quote.id &&
							cardlessRenewalContext(subscription) === previous.context &&
							Date.parse(previous.quote.expiresAt) > serverNow &&
							Date.parse(previous.quote.firstChargeAt) ===
								Date.parse(subscription.trial.endsAt)
							? {
									...previous,
									expiresAtLocal: Math.min(
										previous.expiresAtLocal,
										receivedAt +
											Date.parse(previous.quote.expiresAt) -
											serverNow,
									),
								}
							: null;
					});
					setOverview(result);
					validUntil.current = Date.now() + remaining;
					clearTimeout(displayTimer.current);
					displayTimer.current = setTimeout(() => {
						validUntil.current = 0;
						if (!actionLock.current && document.visibilityState !== "hidden")
							void load(false);
					}, remaining);
					if (refresh) setNotice("Subscription status updated.");
					return true;
				} catch (failure) {
					if (current !== version.current) return false;
					// An acknowledged mutation invalidates the old summary even when
					// reconciliation fails. Quiet read failures keep the last good display.
					if (afterMutation) {
						validUntil.current = 0;
						setOverview(null);
						setRenewalQuote(null);
					}
					if (
						failure instanceof BillingOwnerChangedError ||
						(failure instanceof ApiError &&
							[401, 403, 409].includes(failure.status))
					) {
						validUntil.current = 0;
						setOverview(null);
						setRenewalSelections({});
						setRenewalQuote(null);
					}
					setError(
						failure instanceof Error
							? failure.message
							: "Could not load your subscription. Please try again.",
					);
					return false;
				} finally {
					if (current === version.current) setBusy(false);
				}
			})();
			const entry = { version: version.current, departure, promise };
			pendingRead.current = entry;
			void promise.finally(() => {
				if (pendingRead.current === entry) pendingRead.current = null;
			});
			return promise;
		},
		[ownerUserId],
	);
	const retireAccountDisplay = useCallback(() => {
		validUntil.current = 0;
		setOverview(null);
		setPlanQuote(null);
		setRenewalQuote(null);
		setRenewalSelections({});
	}, []);

	useEffect(() => {
		const abort =
			lifetime.current && !lifetime.current.signal.aborted
				? lifetime.current
				: new AbortController();
		lifetime.current = abort;
		const remaining = snapshot
			? serverSnapshotRemainingMs(snapshot.remainingMs)
			: 0;
		if (remaining > 0 && snapshot) {
			serverClock.current = {
				time:
					Date.parse(snapshot.overview.serverTime ?? "") +
					billingDisplayValidityMs(snapshot.overview) -
					remaining,
				receivedAt: Date.now(),
			};
			validUntil.current = Date.now() + remaining;
			displayTimer.current = setTimeout(() => {
				validUntil.current = 0;
				if (!actionLock.current && document.visibilityState !== "hidden")
					void load(false);
			}, remaining);
		} else void load(returnedFromPortal, true);
		const onFocus = () => {
			if (!actionLock.current && document.visibilityState !== "hidden")
				void load(false);
		};
		const onBlur = () => {
			++departures.current;
		};
		const onVisibility = () => {
			if (document.visibilityState === "hidden") onBlur();
			else onFocus();
		};
		window.addEventListener("focus", onFocus);
		window.addEventListener("blur", onBlur);
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			abort.abort();
			clearTimeout(displayTimer.current);
			version.current += 1;
			window.removeEventListener("focus", onFocus);
			window.removeEventListener("blur", onBlur);
			document.removeEventListener("visibilitychange", onVisibility);
			trialAbort.current?.abort();
			trialAbort.current = null;
			actionLock.current = false;
		};
	}, [load, returnedFromPortal, snapshot]);

	useEffect(() => {
		if (!overview) return;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const checkBoundary = () => {
			const remaining =
				billingDisplayValidityMs(overview, Infinity) -
				(serverClock.current.time +
					Date.now() -
					serverClock.current.receivedAt -
					Date.parse(overview.serverTime ?? ""));
			if (!Number.isFinite(remaining)) return;
			if (remaining <= 0) {
				setOverview(null);
				setPlanQuote(null);
				setRenewalQuote(null);
			} else
				timer = setTimeout(checkBoundary, Math.min(remaining, 2_147_483_647));
		};
		// Real expiry is independent of display TTL; long dates must not overflow timers.
		checkBoundary();
		return () => clearTimeout(timer);
	}, [overview]);

	useEffect(() => {
		if (!renewalQuote) return;
		// Retire terms independently of the subscription display lease. This must
		// never invalidate or abort a setup request already sent with consent.
		const timer = setTimeout(
			() => {
				setRenewalQuote((current) =>
					current?.requestId === renewalQuote.requestId ? null : current,
				);
			},
			Math.max(0, renewalQuote.expiresAtLocal - Date.now()),
		);
		return () => clearTimeout(timer);
	}, [renewalQuote]);

	const trialAction = useCallback(
		async (
			action: CardlessRenewalAction,
			input: Record<string, unknown>,
			subscription?: BillingSubscription,
		) => {
			if (actionLock.current) return;
			actionLock.current = true;
			const current = ++version.current;
			const abort = new AbortController();
			const departure = departures.current;
			trialAbort.current = abort;
			setTrialBusy(true);
			setBusy(true);
			setError(null);
			setNotice(null);
			try {
				const body =
					action === "cancel"
						? { requestId: (cancelRequestId.current ??= crypto.randomUUID()) }
						: input;
				await guardBillingNavigation(
					ownerUserId,
					abort.signal,
					departures.current !== departure,
					() => departures.current,
				);
				if (current !== version.current) return;
				let result = await postTrialAction<
					RenewalSetupResult | (TrialRenewalQuote & { state: "quoted" })
				>(
					`renewal/${action === "confirm" ? "quote" : action}`,
					ownerUserId,
					body,
					abort.signal,
				);
				await guardBillingNavigation(
					ownerUserId,
					abort.signal,
					departures.current !== departure,
					() => departures.current,
				);
				if (current !== version.current || abort.signal.aborted) return;
				if (result.state === "quoted") {
					if (
						!subscription ||
						result.planCode !== input.planCode ||
						result.billingPeriod !== input.billingPeriod ||
						!result.id ||
						!Number.isFinite(result.amount) ||
						result.amount <= 0 ||
						!result.currency ||
						!Number.isFinite(Date.parse(result.firstChargeAt)) ||
						!Number.isFinite(Date.parse(result.expiresAt))
					)
						throw new Error(
							"Renewal terms could not be confirmed. Please review them again.",
						);
					const now = Date.now();
					const remaining =
						Date.parse(result.expiresAt) -
						(serverClock.current.time + now - serverClock.current.receivedAt);
					if (
						!(remaining > 0) ||
						Date.parse(result.firstChargeAt) !==
							Date.parse(subscription.trial?.endsAt ?? "")
					)
						throw new Error("Renewal terms expired. Please review them again.");
					setRenewalQuote({
						expiresAtLocal: now + remaining,
						quote: result,
						requestId: crypto.randomUUID(),
						subscriptionId: subscription.id,
						context: cardlessRenewalContext(subscription),
					});
					if (action !== "confirm") return;
					if (
						result.amount !== input.amount ||
						result.currency !== input.currency ||
						Date.parse(result.firstChargeAt) !==
							Date.parse(String(input.firstChargeAt))
					) {
						setNotice(
							"The renewal terms changed. Review the updated price and date, then confirm again.",
						);
						return;
					}
					result = await postTrialAction<RenewalSetupResult>(
						"renewal/setup",
						ownerUserId,
						{
							quoteId: result.id,
							requestId: crypto.randomUUID(),
							...(input.savedCardSourceId
								? { savedCardSourceId: input.savedCardSourceId }
								: {}),
						},
						abort.signal,
					);
					await guardBillingNavigation(
						ownerUserId,
						abort.signal,
						departures.current !== departure,
						() => departures.current,
					);
					if (current !== version.current || abort.signal.aborted) return;
				}
				if (result.state === "setup") {
					window.location.assign(secureTrialSetupUrl(result.url));
				} else {
					setRenewalQuote(null);
					if (
						["canceled", "active", "superseded", "expired"].includes(
							result.state,
						)
					)
						cancelRequestId.current = null;
					const refreshedVersion = version.current + 1;
					const accepted = await load(true, false, true);
					if (
						accepted &&
						version.current === refreshedVersion &&
						!abort.signal.aborted
					) {
						setRenewalPreviewRevision((n) => n + 1);
						setNotice(
							result.state === "active"
								? "Renewal is confirmed. Your original trial end stays the same."
								: result.state === "canceled"
									? "Renewal is off. Your remaining trial access stays available."
									: trialResultMessage(result.state),
						);
					}
				}
			} catch (failure) {
				if (current === version.current && !abort.signal.aborted) {
					if (failure instanceof BillingOwnerChangedError)
						retireAccountDisplay();
					if (action === "quote") setRenewalQuote(null);
					setError(
						failure instanceof Error
							? failure.message
							: "Could not confirm trial renewal. Refresh its status.",
					);
				}
			} finally {
				if (trialAbort.current === abort) {
					setTrialBusy(false);
					trialAbort.current = null;
					actionLock.current = false;
					if (current === version.current) {
						setBusy(false);
						if (Date.now() >= validUntil.current) void load(false);
					}
				}
			}
		},
		[load, ownerUserId, retireAccountDisplay],
	);
	const previewRenewal = useCallback(async () => {
		const signal = (lifetime.current ??= new AbortController()).signal;
		const departure = departures.current;
		try {
			const result = await postTrialAction<
				(TrialRenewalPreview & { state: "preview" }) | RenewalSetupResult
			>("renewal/preview", ownerUserId, {}, signal);
			await guardBillingNavigation(
				ownerUserId,
				signal,
				departures.current !== departure,
				() => departures.current,
			);
			if (result.state !== "preview")
				throw new Error(trialResultMessage(result.state));
			if (
				result.options.length !== 4 ||
				result.options.some(
					(o) =>
						!Number.isSafeInteger(o.amount) ||
						o.amount <= 0 ||
						o.currency !== "usd",
				) ||
				!Number.isFinite(Date.parse(result.firstChargeAt)) ||
				!Number.isFinite(Date.parse(result.serverTime))
			)
				throw new Error("Renewal terms unavailable. Please try again.");
			return result;
		} catch (e) {
			if (e instanceof BillingOwnerChangedError) retireAccountDisplay();
			throw e;
		}
	}, [ownerUserId, retireAccountDisplay]);

	const trialSetupOperationId = trialSetupReturn?.operationId;
	useEffect(() => {
		if (!trialSetupOperationId) return;
		let disposed = false;
		queueMicrotask(() => {
			if (!disposed)
				void trialAction("complete", {
					operationId: trialSetupOperationId,
				});
		});
		return () => {
			disposed = true;
		};
	}, [trialAction, trialSetupOperationId]);

	async function changeTrial(
		subscriptionId: string,
		planCode: "plus" | "pro",
		confirm = false,
		billingPeriod?: BillingPeriod,
	) {
		if (actionLock.current) return;
		actionLock.current = true;
		const current = ++version.current;
		const departure = departures.current;
		setBusy(true);
		setError(null);
		try {
			await guardBillingNavigation(
				ownerUserId,
				lifetime.current!.signal,
				departure !== departures.current,
				() => departures.current,
			);
			if (current !== version.current) return;
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
			await guardBillingNavigation(
				ownerUserId,
				lifetime.current!.signal,
				departure !== departures.current,
				() => departures.current,
			);
			if (current !== version.current) return;
			if (result.ownerUserId !== ownerUserId)
				throw new BillingOwnerChangedError();
			if (confirm) {
				setPlanQuote(null);
				await load(true, false, true);
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
				if (failure instanceof BillingOwnerChangedError) retireAccountDisplay();
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
		const departure = departures.current;
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
				throw new BillingOwnerChangedError();
			await guardBillingNavigation(
				ownerUserId,
				lifetime.current!.signal,
				departure !== departures.current,
				() => departures.current,
			);
			if (current !== version.current) return;
			window.location.assign(result.url);
		} catch (failure) {
			if (current !== version.current) return;
			if (failure instanceof BillingOwnerChangedError) retireAccountDisplay();
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
			manageRequested={manageRequested}
			overview={overview}
			busy={busy}
			error={error}
			notice={notice}
			planQuote={planQuote}
			load={load}
			changeTrial={changeTrial}
			openStripe={openStripe}
			setPlanQuote={setPlanQuote}
			renderTrialControls={(subscription, active, onBack) => (
				<CardlessTrialControls
					key={subscription.id}
					subscription={subscription}
					active={active}
					onBack={onBack}
					busy={trialBusy}
					onPreview={previewRenewal}
					previewRevision={renewalPreviewRevision}
					selection={
						renewalSelections[subscription.id] ?? {
							planCode: subscription.planCode === "pro" ? "pro" : "plus",
							billingPeriod: subscription.price?.billingPeriod ?? "monthly",
						}
					}
					onSelectionChange={(selection) =>
						setRenewalSelections((previous) => ({
							...previous,
							[subscription.id]: selection,
						}))
					}
					quote={
						renewalQuote?.subscriptionId === subscription.id
							? renewalQuote
							: null
					}
					onAction={(action, input) => trialAction(action, input, subscription)}
					onDismiss={() => setRenewalQuote(null)}
				/>
			)}
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
	renderTrialControls,
	manageRequested = false,
}: {
	manageRequested?: boolean;
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
	load: (refresh: boolean) => Promise<unknown>;
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
	renderTrialControls?: (
		subscription: BillingSubscription,
		active: boolean,
		onBack: () => void,
	) => ReactNode;
}) {
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});
	const owned = overview?.ownerUserId === ownerUserId ? overview : null;
	const current =
		owned?.subscriptions.filter((s) => !isPastSubscription(s)) ?? [];
	const previous = owned?.subscriptions.filter(isPastSubscription) ?? [];
	const endedTrial =
		owned?.planCode === "free" &&
		current.length === 0 &&
		!owned.pendingTrialActivation
			? previous.find(
					(s) =>
						s.trial?.mode === "cardless" &&
						s.trial.stage === "ended" &&
						!s.trial.renewalEnabled &&
						!s.trial.pendingRenewal,
				)
			: undefined;
	const expansionKey = (s: BillingSubscription) =>
		`${s.id}:${s.trial?.pendingRenewal?.id ?? ""}`;
	const isExpanded = (s: BillingSubscription) =>
		expanded[expansionKey(s)] ??
		(manageRequested || Boolean(s.trial?.pendingRenewal));
	const setExpandedFor = (s: BillingSubscription, open: boolean) =>
		setExpanded((previous) =>
			previous[expansionKey(s)] === open
				? previous
				: { ...previous, [expansionKey(s)]: open },
		);
	const editing = current.some(
		(s) => hasSubscriptionSummary(s) && isExpanded(s),
	);
	return (
		<div className="ac-page ac-billing ac-billing-clean" aria-busy={busy}>
			{editing && <h1 className="sr-only">Subscription</h1>}
			<header className="billing-header" hidden={editing}>
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
					{owned.pendingTrialActivation && (
						<section className="ac-notice" aria-label="Trial request status">
							<p>
								Your {PLAN_NAMES[owned.pendingTrialActivation.planCode]} trial
								is being prepared. Check this request before starting another
								checkout.
							</p>
							<Link
								className="ac-button ac-button-primary"
								href={checkoutReturnPath({
									plan: owned.pendingTrialActivation.planCode,
									billing: owned.pendingTrialActivation.billingPeriod,
								})}
							>
								Check trial status
							</Link>
						</section>
					)}
					{endedTrial && <EndedTrialSummary />}
					{!endedTrial &&
						(owned.planCode === "free" || current.length === 0) && (
							<section className="billing-access" aria-label="Current access">
								<h2>{PLAN_NAMES[owned.planCode]}</h2>
								{owned.planCode === "free" ? (
									<>
										<div className="billing-actions">
											<InstallLink
												href={`${INSTALL_HUB_PATH}#${EXTENSION_USING_HASH}`}
												className="ac-button"
											>
												{INSTALL_CTA_LABEL}
											</InstallLink>
											{!owned.pendingTrialActivation && (
												<Link
													href="/pricing"
													className="ac-button ac-button-primary"
												>
													View plans
													<ArrowRight size={16} aria-hidden />
												</Link>
											)}
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
														Host for 30 minutes a day once a guest joins.
														Waiting alone does not use that time, and pausing
														the video does not stop it. A warning appears with
														five minutes left.
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
							className={
								hasSubscriptionSummary(subscription)
									? "billing-subscription billing-subscription-summary"
									: "billing-subscription"
							}
							aria-label={`${PLAN_NAMES[subscription.planCode]} subscription`}
						>
							{subscription.planCode !== owned.planCode && (
								<p className="ac-muted">
									Current account access: {PLAN_NAMES[owned.planCode]}.
								</p>
							)}
							<SubscriptionPresentation
								key={subscription.id}
								subscription={subscription}
								busy={busy}
								open={isExpanded(subscription)}
								onOpenChange={(open) => setExpandedFor(subscription, open)}
								heading={
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
								}
							>
								{!(
									subscription.trial?.mode === "cardless" &&
									subscription.trial.stage === "trial"
								) && <SubscriptionFacts subscription={subscription} />}
								{renderTrialControls?.(
									subscription,
									isExpanded(subscription),
									() => setExpandedFor(subscription, false),
								)}
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
											onClick={() =>
												void openStripe(subscription.id, "payment")
											}
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
												onClick={() =>
													void openStripe(subscription.id, "cancel")
												}
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
														(!subscription.trial ||
															subscription.trial.stage === "paid")
													? "Cancel renewal in Stripe. Access stays until the end of your paid period."
													: "Confirm cancellation in Stripe to stop future renewals."
											: "Restore renewal in Stripe. Your current end date stays the same."}
									</p>
								)}
							</SubscriptionPresentation>
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
					{!endedTrial && (
						<footer className="billing-footer">
							{editing && (
								<button
									type="button"
									className="ac-button ac-button-quiet"
									onClick={() => void load(true)}
									disabled={busy}
								>
									<RefreshCw size={15} aria-hidden />
									Refresh status
								</button>
							)}
							<Link href="/pricing">
								Compare plans
								<ArrowRight size={15} aria-hidden />
							</Link>
							<a href="mailto:anidachi.app@gmail.com">
								Contact support
								<ArrowRight size={15} aria-hidden />
							</a>
						</footer>
					)}
				</>
			)}
		</div>
	);
}

function isPastSubscription(subscription: BillingSubscription) {
	if (
		subscription.trial?.mode === "cardless" &&
		subscription.trial.pendingRenewal
	)
		return false;
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
	const timeZone = useBillingTimeZone();
	const trial = subscription.trial;
	const inTrial = trial?.stage === "trial";
	const cardless = trial?.mode === "cardless";
	const showTrialDeadline = inTrial || (cardless && trial.stage !== "paid");
	const price = subscriptionPriceLabel(subscription);
	const paymentPeriod =
		subscription.price?.billingPeriod ??
		(subscription.monthlyPrice ? "monthly" : "subscription");
	const priceTitle =
		inTrial &&
		(cardless
			? trial.renewalState === "enabled"
			: !subscription.cancelAtPeriodEnd)
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
						{showTrialDeadline
							? formatBillingTime(trial.endsAt, timeZone)
							: formatDate(subscription.currentPeriodEnd, timeZone)}
					</dd>
					{showTrialDeadline && (
						<dd className="billing-timezone">Your local time</dd>
					)}
				</div>
				<div>
					<dt>{priceTitle}</dt>
					<dd>{price ?? "Amount unavailable"}</dd>
				</div>
			</dl>
			<div className="billing-terms">
				{inTrial && (
					<p>
						{cardless
							? trial.renewalState === "pending"
								? "A renewal change is being confirmed. Check the controls below for its current status."
								: trial.renewalState === "enabled"
									? "Renewal is enabled. Your first payment is scheduled for the end of your trial."
									: "No automatic charge. Access ends after 3 days unless you choose to enable renewal."
							: subscription.cancelAtPeriodEnd
								? "No payment scheduled. Access continues until your trial ends."
								: "Renews automatically after your trial."}
					</p>
				)}
				{!inTrial &&
					subscription.cancelAtPeriodEnd &&
					(!cardless || trial?.stage === "paid") && (
						<p>Renewal is canceled. Access continues until the date shown.</p>
					)}
				{!trial &&
					subscription.status === "active" &&
					!subscription.cancelAtPeriodEnd && <p>Renews automatically.</p>}
				{trial?.stage === "paid" &&
					subscription.status === "active" &&
					!subscription.cancelAtPeriodEnd && <p>Renews automatically.</p>}
				{trial?.stage === "processing" && (
					<p className="billing-warning">
						Your first payment is being confirmed. This is not yet a paid
						period. Temporary access lasts at most until{" "}
						{formatBillingTime(trial.pendingUntil, timeZone)} (your local time).
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
