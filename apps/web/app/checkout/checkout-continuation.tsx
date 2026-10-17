"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { AuthPageShell } from "@/components/auth-page-shell";
import { Button } from "@/components/ui/button";
import {
	checkoutSessionRecoveryPath,
	checkoutReturnPath,
	checkoutPlansPath,
	type CheckoutSelection,
} from "@/lib/checkout-selection";
import { PUBLISHED_PRICING } from "@/lib/pricing-tiers";
import type { PricingOffer } from "@/lib/pricing-offer";
import { getSeoAttributionFields } from "@/lib/seo-landing-path";
import { trackConversion } from "@/lib/conversion-events";
import { postTrialAction, trialResultMessage } from "@/lib/trial-client";
import type { TrialStartResult } from "@/lib/anidachi-auth/cardless-trial";
import { LoginOAuthButtons } from "../login/login-oauth-buttons";
import {
	prepareTrialBrowserContext,
	requestTrialInstallationProof,
} from "@/lib/trial-abuse-client";
import { resolveBrowserTrialOffer } from "@/lib/trial-offer-client";
import { TrialStartView } from "./trial-start-view";
import { OnboardingReturn } from "@/components/onboarding-return";
import { rememberOnboardingCheckout } from "@/lib/onboarding-return-client";
import {
	BillingOwnerChangedError,
	guardBillingNavigation,
} from "@/lib/billing-navigation";

type Stage =
	| "checking"
	| "opening"
	| "subscribe"
	| "trial"
	| "pending"
	| "verification"
	| "error";
type Confirmation = {
	owner: string;
	action: PricingOffer["action"];
	mode: PricingOffer["trialMode"];
	revision?: string;
};

export function CheckoutContinuation({
	selection,
	extensionId,
}: {
	selection: CheckoutSelection;
	extensionId?: string | null;
}) {
	const { plan, billing, confirmTrial, onboarding } = selection;
	const [completedOwner, setCompletedOwner] = useState<string | null>(null);
	const label = plan === "plus" ? "Plus" : "Pro";
	const price = PUBLISHED_PRICING[billing][plan];
	const amount = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: price.currency,
	}).format(price.unitAmount / 100);
	const period = billing === "yearly" ? "year" : "month";
	const [stage, setStage] = useState<Stage>("checking");
	const [message, setMessage] = useState("");
	const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
	const reviewedCardless = useRef(false);
	const recovery = useRef<{
		owner: string;
		operationId?: string;
		legacy?: boolean;
		revision: string;
	} | null>(null);
	const busy = useRef(false);
	const [working, setWorking] = useState(false);
	const departures = useRef(0);
	const generation = useRef(0);
	const controller = useRef<AbortController | null>(null);
	const request = useRef<{ owner: string; id: string } | null>(null);
	const prepared = useRef<{
		requestId: string;
		signature: string;
		deadline: number;
		departure: number;
		checked: Awaited<ReturnType<typeof resolveBrowserTrialOffer>>;
	} | null>(null);

	const start = useCallback(
		async (confirmed?: Confirmation) => {
			if (busy.current) return;
			busy.current = true;
			setWorking(true);
			const version = ++generation.current;
			const abort = new AbortController();
			controller.current = abort;
			const current = () =>
				version === generation.current && !abort.signal.aborted;
			let checkedDeparture = departures.current;
			const guard = async (owner: string) => {
				await guardBillingNavigation(
					owner,
					abort.signal,
					departures.current !== checkedDeparture,
					() => departures.current,
				);
				checkedDeparture = departures.current;
			};
			if (!confirmed) setStage("checking");
			setMessage("");
			if (!confirmed) setConfirmation(null);
			const showTrialResult = (
				result: TrialStartResult,
				owner: string,
				revision: string,
			) => {
				if (result.state === "active") {
					recovery.current = null;
					if (onboarding) setCompletedOwner(owner);
					else window.location.replace("/account/billing");
				} else if (result.state === "pending") {
					recovery.current = {
						owner,
						revision,
						...(result.kind === "activation"
							? { operationId: result.operationId }
							: { legacy: true }),
					};
					setStage("pending");
					setMessage(
						"Your trial is being prepared. You can safely check its status here.",
					);
				} else {
					if (result.state !== "unavailable") recovery.current = null;
					if (result.state === "trial_used") {
						request.current = null;
						setStage("subscribe");
						setConfirmation({
							owner,
							action: "subscribe",
							mode: "cardless",
							revision,
						});
						setMessage(
							"The free trial is no longer available. You can choose a subscription below.",
						);
						return;
					}
					// Only a confirmed terminal result retires the old request. Unknown outcomes keep recovery.
					if (result.state === "ineligible") request.current = null;
					setStage(
						result.state === "verification_required"
							? "verification"
							: recovery.current
								? "pending"
								: "error",
					);
					setMessage(trialResultMessage(result.state));
				}
			};
			try {
				const started = Date.now();
				const response = await fetch("/api/billing/offer", {
					cache: "no-store",
					signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15_000)]),
				});
				if (!response.ok)
					throw new Error(
						"We could not check your subscription. Please try again.",
					);
				let offer = (await response.json()) as PricingOffer;
				if (!current()) return;

				if (!(Math.min(60_000, offer.validForMs) > Date.now() - started))
					throw new Error("Your offer expired. Please try again.");
				if (offer.action === "sign_in") {
					window.location.replace(
						checkoutSessionRecoveryPath({ plan, billing, confirmTrial, onboarding }),
					);
					return;
				}
				if (!offer.ownerUserId)
					throw new Error(
						"We could not confirm your account. Please try again.",
					);
				if (
					(confirmed && confirmed.owner !== offer.ownerUserId) ||
					(recovery.current && recovery.current.owner !== offer.ownerUserId)
				) {
					recovery.current = null;
					throw new Error(
						"Your account changed. Please check your subscription again.",
					);
				}
				if (offer.pendingTrialActivation && !recovery.current) {
					recovery.current = {
						owner: offer.ownerUserId,
						operationId: offer.pendingTrialActivation.id,
						revision: offer.trialOfferRevision ?? "",
					};
				}
				if (recovery.current) {
					const pending = recovery.current;
					setStage("opening");
					await guard(offer.ownerUserId);
					if (!current()) return;
					let extensionProof;
					if (pending.legacy) {
						// Reconciliation has not reserved an activation yet, so this is still a new grant.
						const retry = request.current;
						if (!retry || retry.owner !== offer.ownerUserId)
							throw new Error("Please review the trial confirmation again.");
						const context = await prepareTrialBrowserContext(
							offer.ownerUserId,
							retry.id,
							abort.signal,
						);
						if (!current()) return;

						extensionProof = await requestTrialInstallationProof(
							context,
							abort.signal,
						);
						if (!current()) return;
					}
					await guard(offer.ownerUserId);
					if (!current()) return;
					const result = await postTrialAction<TrialStartResult>(
						pending.legacy ? "start" : "recover",
						offer.ownerUserId,
						pending.legacy
							? {
									requestId: request.current?.id,
									planCode: plan,
									billingPeriod: billing,
									offerRevision: pending.revision,
									...(extensionProof ? { extensionProof } : {}),
								}
							: pending.operationId
								? { operationId: pending.operationId }
								: {},
						abort.signal,
					);
					await guard(offer.ownerUserId);
					if (current())
						showTrialResult(result, offer.ownerUserId, pending.revision);
					return;
				}
				if (offer.ownerUserId && request.current?.owner !== offer.ownerUserId) {
					request.current = {
						owner: offer.ownerUserId,
						id: crypto.randomUUID(),
					};
				}
				const signature = JSON.stringify({ ...offer, validForMs: undefined });
				const previous = prepared.current;
				const reuse =
					previous &&
					previous.requestId === request.current?.id &&
					previous.signature === signature &&
					previous.deadline > Date.now() &&
					previous.departure === departures.current;
				const checked = reuse
					? previous.checked
					: await resolveBrowserTrialOffer(
							offer,
							abort.signal,
							request.current?.id,
						);
				if (!current()) return;
				if (!reuse && request.current)
					prepared.current = {
						requestId: request.current.id,
						signature,
						checked,
						deadline:
							started +
							Math.min(60_000, offer.validForMs, checked.offer.validForMs),
						departure: checkedDeparture,
					};
				offer = checked.offer;
				if (!offer.ownerUserId || offer.ownerUserId !== request.current?.owner)
					throw new Error("Your account changed. Please try again.");
				if (!(Math.min(60_000, offer.validForMs) > Date.now() - started))
					throw new Error("Your offer expired. Please try again.");
				if (offer.action === "manage") {
					await guard(offer.ownerUserId);
					if (!current()) return;
					window.location.replace("/account/billing");
					return;
				}
				const becamePaid =
					confirmed?.action === "trial" && offer.action === "subscribe";
				if (
					confirmed &&
					!becamePaid &&
					(confirmed.action !== offer.action ||
						confirmed.mode !== offer.trialMode ||
						confirmed.revision !== offer.trialOfferRevision)
				)
					throw new Error(
						"The offer changed. Please review the current terms again.",
					);
				if (offer.action !== "trial" && offer.action !== "subscribe")
					throw new Error("We could not confirm your subscription options.");
				const verifiedPrice = (
					billing === "yearly" ? offer.yearlyPrices : offer.prices
				)?.[plan];
				if (
					!verifiedPrice ||
					verifiedPrice.unitAmount !== price.unitAmount ||
					verifiedPrice.currency.toLowerCase() !== price.currency
				) {
					throw new Error(
						"Checkout for this price is temporarily unavailable. Please try again later.",
					);
				}
				if (becamePaid) {
					setConfirmation({
						owner: offer.ownerUserId,
						action: "subscribe",
						mode: offer.trialMode,
						revision: offer.trialOfferRevision,
					});
					setMessage(
						"The free trial is no longer available. You can choose a subscription below.",
					);
					setStage("subscribe");
					return;
				}
				// The original guest action offered a trial. Never silently replace it with an immediate payment.
				const cardless =
					offer.action === "trial" && offer.trialMode === "cardless";
				if (cardless) reviewedCardless.current = true;
				if (
					!confirmed &&
					(offer.action === "subscribe" ||
						cardless ||
						confirmTrial ||
						reviewedCardless.current)
				) {
					setConfirmation({
						owner: offer.ownerUserId,
						action: offer.action,
						mode: offer.trialMode,
						revision: offer.trialOfferRevision,
					});
					setStage(offer.action === "subscribe" ? "subscribe" : "trial");
					return;
				}
				if (request.current?.owner !== offer.ownerUserId)
					request.current = {
						owner: offer.ownerUserId,
						id: crypto.randomUUID(),
					};
				if (!confirmed) setStage("opening");
				await guard(offer.ownerUserId);
				if (!current()) return;
				if (cardless) {
					if (!offer.trialOfferRevision)
						throw new Error(
							"The offer changed. Review the plans before continuing.",
						);
					const extensionProof = checked.extensionProof;
					if (!current()) return;
					recovery.current = {
						owner: offer.ownerUserId,
						revision: offer.trialOfferRevision,
					};
					const result = await postTrialAction<TrialStartResult>(
						"start",
						offer.ownerUserId,
						{
							requestId: request.current!.id,
							planCode: plan,
							billingPeriod: billing,
							offerRevision: offer.trialOfferRevision,
							...(extensionProof ? { extensionProof } : {}),
						},
						abort.signal,
					);
					await guard(offer.ownerUserId);
					if (current())
						showTrialResult(
							result,
							offer.ownerUserId,
							offer.trialOfferRevision,
						);
					return;
				}
				const attribution = getSeoAttributionFields();
				trackConversion("checkout_session_started", {
					page_path: "/checkout",
					page_template: "default",
					placement: "checkout_after_sign_in",
					plan_tier: plan,
				});
				const checkout = await fetch("/api/create-checkout-session", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					signal: AbortSignal.any([abort.signal, AbortSignal.timeout(45_000)]),
					body: JSON.stringify({
						planCode: plan,
						billingPeriod: billing,
						requestId: request.current.id,
						expectedOwnerUserId: offer.ownerUserId,
						expectedTrialOffered: offer.action === "trial",
						expectedPrice: price,
						seoLandingPath: attribution.seo_landing_path,
						checkoutPagePath: "/checkout",
						seoReferrer: attribution.seo_referrer,
						seoUtm: attribution.seo_utm,
					}),
				});
				const data = (await checkout.json()) as {
					url?: string;
					sessionId?: string;
					error?: string;
					kind?: string;
				};
				await guard(offer.ownerUserId);
				if (!current()) return;
				if (checkout.status === 401) {
					window.location.replace(
						checkoutSessionRecoveryPath({ plan, billing, confirmTrial, onboarding }),
					);
					return;
				}
				if (!checkout.ok)
					throw new Error(
						data.error ?? "We could not open checkout. Please try again.",
					);
				if (data.kind === "manage_subscription") {
					window.location.replace("/account/billing");
					return;
				}
				const url = new URL(data.url ?? "");
				if (
					url.protocol !== "https:" ||
					url.hostname !== "checkout.stripe.com" ||
					url.username ||
					url.password
				)
					throw new Error(
						"We could not open secure checkout. Please try again.",
					);
				trackConversion("checkout_redirect_success", {
					page_path: "/checkout",
					page_template: "default",
					placement: "checkout_after_sign_in",
					plan_tier: plan,
				});
				rememberOnboardingCheckout(onboarding, offer.ownerUserId, data.sessionId);
				window.location.replace(url.href);
			} catch (error) {
				if (!current()) return;
				if (error instanceof BillingOwnerChangedError) {
					setConfirmation(null);
					prepared.current = null;
					request.current = null;
					recovery.current = null;
				}
				setMessage(
					error instanceof Error &&
						error.name !== "TypeError" &&
						error.name !== "TimeoutError"
						? error.message
						: "We could not open checkout. Check your connection and try again.",
				);
				setStage(recovery.current ? "pending" : "error");
			} finally {
				if (current()) {
					busy.current = false;
					setWorking(false);
				}
			}
		},
		[plan, billing, confirmTrial, onboarding, price],
	);

	useEffect(() => {
		const pause = () => {
			++departures.current;
		};
		const onVisibilityChange = () => {
			if (document.visibilityState === "hidden") pause();
		};
		void start();
		window.addEventListener("blur", pause);
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			// Retire the latest request generation; this ref is not a DOM node.
			// eslint-disable-next-line react-hooks/exhaustive-deps
			++generation.current;
			controller.current?.abort();
			busy.current = false;
			window.removeEventListener("blur", pause);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [start]);

	if (completedOwner && onboarding) return (
		<AuthPageShell maxWidth="max-w-md">
			<div className="text-center">
				<AnidachiLogo size={48} className="mx-auto" />
				<h1 className="mt-6 text-3xl font-semibold tracking-tight">Your free trial has started</h1>
				<OnboardingReturn token={onboarding} owner={completedOwner} extensionId={extensionId} />
				<Link className="text-sm text-ani-muted underline underline-offset-4" href="/account/billing">Manage subscription</Link>
			</div>
		</AuthPageShell>
	);
	if (stage === "checking")
		return (
			<AuthPageShell maxWidth="max-w-md">
				<div
					role="status"
					className="flex min-h-48 items-center justify-center"
				>
					<Loader2
						size={24}
						className="animate-spin text-ani-muted motion-reduce:animate-none"
						aria-hidden="true"
					/>
					<span className="sr-only">Loading plans</span>
				</div>
			</AuthPageShell>
		);

	if (stage === "trial" && confirmation?.mode === "cardless") {
		return (
			<TrialStartView
				selection={selection}
				busy={working}
				onStart={() => void start(confirmation)}
			/>
		);
	}

	return (
		<AuthPageShell maxWidth="max-w-md">
			<div className="text-center">
				<AnidachiLogo size={48} className="mx-auto" />
				<h1 className="mt-6 text-3xl font-semibold tracking-tight">
					Continue with{" "}
					<span className="text-[var(--ani-menu-accent)]">{label}</span>
				</h1>
				<p className="mt-3 text-ani-muted">
					{billing === "yearly" ? "Yearly" : "Monthly"} · {amount}/{period}
				</p>
				{stage === "opening" && (
					<p
						role="status"
						className="mt-8 flex items-center justify-center gap-3 text-sm text-ani-muted"
					>
						<Loader2 size={18} className="animate-spin" aria-hidden="true" />
						{reviewedCardless.current
							? "Confirming your trial…"
							: "Opening secure checkout…"}
					</p>
				)}
				{stage === "subscribe" && (
					<div className="mt-8 border-t border-ani-line pt-6">
						<p>{message || "Host watch parties with your friends."}</p>
						<p className="mt-3 text-sm leading-6 text-ani-muted">
							{amount} billed now. Renews automatically every {period}. You can
							cancel renewal from your account.
						</p>
						<Button
							variant="cream"
							disabled={working}
							aria-busy={working}
							className="mt-6 w-full"
							onClick={() => void start(confirmation ?? undefined)}
						>
							Subscribe to {label}
						</Button>
					</div>
				)}
				{stage === "trial" && (
					<div className="mt-8 border-t border-ani-line pt-6">
						<p className="text-xl font-medium">3 days of {label}</p>
						<p className="mt-3 text-sm leading-6 text-ani-muted">
							A card is required. After 3 days, {amount} is charged every{" "}
							{period} unless you cancel renewal.
						</p>
						<Button
							className="mt-6 w-full"
							disabled={working}
							aria-busy={working}
							onClick={() => void start(confirmation ?? undefined)}
						>
							Continue to card checkout
						</Button>
					</div>
				)}
				{(stage === "pending" || stage === "verification") && (
					<div className="mt-8">
						<p role="status" className="text-sm leading-6 text-ani-muted">
							{message}
						</p>
						{stage === "pending" ? (
							<Button className="mt-5 w-full" onClick={() => void start()}>
								Check trial status
							</Button>
						) : (
							<div className="mt-5">
								<LoginOAuthButtons
									safeNext={encodeURIComponent(
										checkoutReturnPath({ plan, billing, confirmTrial, onboarding }),
									)}
								/>
							</div>
						)}
					</div>
				)}
				{stage === "error" && (
					<div className="mt-8">
						<p role="alert" className="text-sm leading-6 text-ani-muted">
							{message}
						</p>
						<Button className="mt-5 w-full" onClick={() => void start()}>
							Try again
						</Button>
					</div>
				)}
				<Link
					href={checkoutPlansPath(selection)}
					className="mt-7 inline-block text-sm text-ani-muted underline underline-offset-4 hover:text-ani-text"
				>
					Back to plans
				</Link>
			</div>
		</AuthPageShell>
	);
}
