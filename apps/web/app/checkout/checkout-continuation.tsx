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
	type TrialBrowserContext,
} from "@/lib/trial-abuse-client";
import { TrialStartView } from "./trial-start-view";

type Stage =
	| "checking"
	| "opening"
	| "subscribe"
	| "trial"
	| "pending"
	| "verification"
	| "error"
	| "trial_used";
type Confirmation = {
	owner: string;
	action: PricingOffer["action"];
	mode: PricingOffer["trialMode"];
	revision?: string;
};

export function CheckoutContinuation({
	selection,
}: {
	selection: CheckoutSelection;
}) {
	const { plan, billing, confirmTrial } = selection;
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
	const generation = useRef(0);
	const controller = useRef<AbortController | null>(null);
	const browserContext = useRef<{
		owner: string;
		requestId: string;
		at: number;
		value: TrialBrowserContext;
	} | null>(null);
	const request = useRef<{ owner: string; id: string } | null>(null);

	const start = useCallback(
		async (confirmed?: Confirmation) => {
			if (busy.current) return;
			busy.current = true;
			const version = ++generation.current;
			const abort = new AbortController();
			controller.current = abort;
			const current = () =>
				version === generation.current && !abort.signal.aborted;
			setStage("checking");
			setMessage("");
			setConfirmation(null);
			const showTrialResult = (
				result: TrialStartResult,
				owner: string,
				revision: string,
			) => {
				if (result.state === "active") {
					recovery.current = null;
					window.location.replace("/account/billing");
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
					if (result.state === "context_required")
						browserContext.current = null;
					if (result.state === "trial_used") {
						request.current = null;
						browserContext.current = null;
						setStage("trial_used");
						setMessage(trialResultMessage(result.state));
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
				const offer = (await response.json()) as PricingOffer;
				if (!current()) return;
				if (!(Math.min(60_000, offer.validForMs) > Date.now() - started))
					throw new Error("Your offer expired. Please try again.");
				if (offer.action === "sign_in") {
					window.location.replace(
						checkoutSessionRecoveryPath({ plan, billing, confirmTrial }),
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
					const result = await postTrialAction<TrialStartResult>(
						pending.legacy ? "start" : "recover",
						offer.ownerUserId,
						pending.legacy
							? {
									requestId: request.current?.id,
									planCode: plan,
									billingPeriod: billing,
									offerRevision: pending.revision,
								}
							: pending.operationId
								? { operationId: pending.operationId }
								: {},
						abort.signal,
					);
					if (current())
						showTrialResult(result, offer.ownerUserId, pending.revision);
					return;
				}
				if (
					confirmed &&
					(confirmed.action !== offer.action ||
						confirmed.mode !== offer.trialMode ||
						confirmed.revision !== offer.trialOfferRevision)
				)
					throw new Error(
						"The offer changed. Please review the current terms again.",
					);
				if (offer.action === "manage") {
					window.location.replace("/account/billing");
					return;
				}
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
				// The original guest action offered a trial. Never silently replace it with an immediate payment.
				const cardless =
					offer.action === "trial" && offer.trialMode === "cardless";
				if (cardless) reviewedCardless.current = true;
				if (cardless) {
					if (request.current?.owner !== offer.ownerUserId)
						request.current = {
							owner: offer.ownerUserId,
							id: crypto.randomUUID(),
						};
					if (
						!browserContext.current ||
						browserContext.current.owner !== offer.ownerUserId ||
						browserContext.current.requestId !== request.current.id ||
						Date.now() - browserContext.current.at > 240_000
					) {
						const context = await prepareTrialBrowserContext(
							offer.ownerUserId,
							request.current.id,
							abort.signal,
						);
						if (!current()) return;
						browserContext.current = {
							owner: offer.ownerUserId,
							requestId: request.current.id,
							at: Date.now(),
							value: context,
						};
					}
				}
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
				setStage("opening");
				if (cardless) {
					if (!offer.trialOfferRevision)
						throw new Error(
							"The offer changed. Review the plans before continuing.",
						);
					const extensionProof = await requestTrialInstallationProof(
						browserContext.current!.value,
						abort.signal,
					);
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
					error?: string;
					kind?: string;
				};
				if (!current()) return;
				if (checkout.status === 401) {
					window.location.replace(
						checkoutSessionRecoveryPath({ plan, billing, confirmTrial }),
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
				window.location.replace(url.href);
			} catch (error) {
				if (!current()) return;
				setMessage(
					error instanceof Error &&
						error.name !== "TypeError" &&
						error.name !== "TimeoutError"
						? error.message
						: "We could not open checkout. Check your connection and try again.",
				);
				setStage(recovery.current ? "pending" : "error");
			} finally {
				if (current()) busy.current = false;
			}
		},
		[plan, billing, confirmTrial, price],
	);

	useEffect(() => {
		const pause = () => {
			// Retire immediately: a late response must not redirect a background tab.
			++generation.current;
			controller.current?.abort();
			busy.current = false;
			setConfirmation(null);
			setStage("error");
			setMessage("Please check your account again to continue checkout.");
		};
		const onVisibilityChange = () => {
			if (document.visibilityState === "hidden") pause();
		};
		if (document.visibilityState === "hidden") pause();
		else void start();
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

	if (stage === "trial" && confirmation?.mode === "cardless") {
		return (
			<TrialStartView
				selection={selection}
				onStart={() => void start(confirmation)}
			/>
		);
	}

	return (
		<AuthPageShell maxWidth="max-w-md">
			<div className="text-center">
				<AnidachiLogo size={48} className="mx-auto" />
				<h1 className="mt-6 text-3xl font-semibold tracking-tight">
					{stage === "trial_used" ? (
						"A free trial has already been used here"
					) : (
						<>Continue with {label}</>
					)}
				</h1>
				<p className="mt-3 text-ani-muted">
					{stage === "trial_used" ? (
						"You can still join friends for free, or choose a plan to host."
					) : (
						<>
							{billing === "yearly" ? "Yearly" : "Monthly"} · {amount}/{period}
						</>
					)}
				</p>
				{(stage === "checking" || stage === "opening") && (
					<p
						role="status"
						className="mt-8 flex items-center justify-center gap-3 text-sm text-ani-muted"
					>
						<Loader2 size={18} className="animate-spin" aria-hidden="true" />
						{stage === "checking"
							? "Checking your subscription…"
							: reviewedCardless.current
								? "Confirming your trial…"
								: "Opening secure checkout…"}
					</p>
				)}
				{stage === "subscribe" && (
					<div className="mt-8 border-t border-ani-line pt-6">
						<p>This account has no free trial available.</p>
						<p className="mt-3 text-sm leading-6 text-ani-muted">
							{amount} billed now. Renews automatically every {period}. You can
							cancel renewal from your account.
						</p>
						<Button
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
										checkoutReturnPath({ plan, billing, confirmTrial }),
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
					href={`/pricing?plan=${plan}&billing=${billing}`}
					className={
						stage === "trial_used"
							? "mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#f4ecdf] px-6 font-semibold text-[#171512] hover:bg-white"
							: "mt-7 inline-block text-sm text-ani-muted underline underline-offset-4 hover:text-ani-text"
					}
				>
					{stage === "trial_used" ? "View plans" : "Back to plans"}
				</Link>
			</div>
		</AuthPageShell>
	);
}
