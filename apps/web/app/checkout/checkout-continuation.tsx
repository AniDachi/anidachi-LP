"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { AuthPageShell } from "@/components/auth-page-shell";
import { Button } from "@/components/ui/button";
import {
	checkoutSessionRecoveryPath,
	type CheckoutSelection,
} from "@/lib/checkout-selection";
import { PUBLISHED_PRICING } from "@/lib/pricing-tiers";
import type { PricingOffer } from "@/lib/pricing-offer";
import { getSeoAttributionFields } from "@/lib/seo-landing-path";
import { trackConversion } from "@/lib/conversion-events";

type Stage = "checking" | "opening" | "subscribe" | "error";

export function CheckoutContinuation({
	selection,
}: {
	selection: CheckoutSelection;
}) {
	const { plan, billing } = selection;
	const label = plan === "plus" ? "Plus" : "Pro";
	const price = PUBLISHED_PRICING[billing][plan];
	const amount = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: price.currency,
	}).format(price.unitAmount / 100);
	const period = billing === "yearly" ? "year" : "month";
	const [stage, setStage] = useState<Stage>("checking");
	const [message, setMessage] = useState("");
	const [confirmationOwner, setConfirmationOwner] = useState<string | null>(
		null,
	);
	const busy = useRef(false);
	const generation = useRef(0);
	const controller = useRef<AbortController | null>(null);
	const request = useRef<{ owner: string; id: string } | null>(null);

	const start = useCallback(
		async (confirmedOwner?: string) => {
			if (busy.current) return;
			busy.current = true;
			const version = ++generation.current;
			const abort = new AbortController();
			controller.current = abort;
			const current = () =>
				version === generation.current && !abort.signal.aborted;
			setStage("checking");
			setMessage("");
			setConfirmationOwner(null);
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
						checkoutSessionRecoveryPath({ plan, billing }),
					);
					return;
				}
				if (!offer.ownerUserId)
					throw new Error(
						"We could not confirm your account. Please try again.",
					);
				if (confirmedOwner && confirmedOwner !== offer.ownerUserId)
					throw new Error(
						"Your account changed. Please check your subscription again.",
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
				if (offer.action === "subscribe" && !confirmedOwner) {
					setConfirmationOwner(offer.ownerUserId);
					setStage("subscribe");
					return;
				}
				if (request.current?.owner !== offer.ownerUserId)
					request.current = {
						owner: offer.ownerUserId,
						id: crypto.randomUUID(),
					};
				setStage("opening");
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
						checkoutSessionRecoveryPath({ plan, billing }),
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
				setStage("error");
			} finally {
				if (current()) busy.current = false;
			}
		},
		[plan, billing, price],
	);

	useEffect(() => {
		const pause = () => {
			// Retire immediately: a late response must not redirect a background tab.
			++generation.current;
			controller.current?.abort();
			busy.current = false;
			setConfirmationOwner(null);
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

	return (
		<AuthPageShell maxWidth="max-w-md">
			<div className="text-center">
				<AnidachiLogo size={48} className="mx-auto" />
				<h1 className="mt-6 text-3xl font-semibold tracking-tight">
					Continue with {label}
				</h1>
				<p className="mt-3 text-ani-muted">
					{billing === "yearly" ? "Yearly" : "Monthly"} · {amount}/{period}
				</p>
				{(stage === "checking" || stage === "opening") && (
					<p
						role="status"
						className="mt-8 flex items-center justify-center gap-3 text-sm text-ani-muted"
					>
						<Loader2 size={18} className="animate-spin" aria-hidden="true" />
						{stage === "checking"
							? "Checking your subscription…"
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
							onClick={() => void start(confirmationOwner ?? undefined)}
						>
							Subscribe to {label}
						</Button>
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
					className="mt-7 inline-block text-sm text-ani-muted underline underline-offset-4 hover:text-ani-text"
				>
					Back to plans
				</Link>
			</div>
		</AuthPageShell>
	);
}
