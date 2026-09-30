"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Lock } from "lucide-react";
import { getPlanPolicy } from "@anidachi/protocol";
import {
	inferPageTemplateFromPath,
	trackConversion,
} from "@/lib/conversion-events";
import {
	PRICING_PLAN_MATRIX_COLUMNS,
	PRICING_PLAN_MATRIX_ROWS,
	PRICING_TIERS,
	PUBLISHED_PRICING,
	type CheckoutTier,
	type PricingTierId,
} from "@/lib/pricing-tiers";
import { INSTALL_CTA_LABEL, INSTALL_HUB_PATH } from "@/lib/install-cta";
import { HomeSectionHeader } from "@/components/home-section-header";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { getSeoAttributionFields } from "@/lib/seo-landing-path";
import type { PricingOffer, PricingPrices } from "@/lib/pricing-offer";
import { formatMonthlyPrice, type BillingPeriod } from "@/lib/billing-view";
import "./pricing.css";

function FeatureList({ features }: { features: string[] }) {
	return (
		<ul className="pricing-plans__features">
			{features.map((feature) => (
				<li key={feature}>
					<Check size={17} aria-hidden="true" />
					<span>{feature}</span>
				</li>
			))}
		</ul>
	);
}

export function Pricing({
	headingLevel = 2,
	showPlanMatrix = false,
}: {
	/** Use 1 on the dedicated /pricing page so the page has a single H1. */
	headingLevel?: 1 | 2;
	/** Full plan-limits table — keep on `/pricing`, omit from homepage `#pricing`. */
	showPlanMatrix?: boolean;
} = {}) {
	const [period, setPeriod] = useState<BillingPeriod>("yearly");
	const [checkoutError, setCheckoutError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submittingTier, setSubmittingTier] = useState<CheckoutTier | null>(
		null,
	);
	const sectionRef = useRef<HTMLElement | null>(null);
	const pricingViewFired = useRef(false);
	const [offer, setOffer] = useState<PricingOffer | null>(null);
	const checkingOfferRef = useRef(true);
	const requestOffer = useRef<(() => Promise<PricingOffer | null>) | null>(
		null,
	);
	const offerDeadline = useRef(0);
	const offerVersion = useRef(0);
	const [reload, setReload] = useState(0);
	const checkoutLock = useRef(false);
	const lastAttemptedTier = useRef<CheckoutTier | null>(null);
	const displayPrices = PUBLISHED_PRICING[period];

	useEffect(() => {
		// Preserve the explicitly chosen monthly flow across the sign-in return.
		if (
			new URLSearchParams(window.location.search).get("billing") === "monthly"
		) {
			setPeriod("monthly");
		}
	}, []);

	useEffect(() => {
		let refreshTimer: ReturnType<typeof setTimeout> | undefined;
		let expiryTimer: ReturnType<typeof setTimeout> | undefined;
		let controller: AbortController | undefined;
		let pending: Promise<PricingOffer | null> | null = null;
		function loadOffer(
			resetAccount = false,
			purchase = false,
		): Promise<PricingOffer | null> {
			clearTimeout(refreshTimer);
			// A scheduled refresh must not invalidate the explicit purchase already
			// being checked by the server. Focus/account changes still retire it.
			if (!resetAccount && !purchase && checkoutLock.current) {
				refreshTimer = setTimeout(() => void loadOffer(), 1000);
				return Promise.resolve(null);
			}
			if (!resetAccount && pending) return pending;
			const request = fetchOffer(resetAccount).finally(() => {
				if (pending === request) pending = null;
			});
			pending = request;
			return request;
		}
		async function fetchOffer(
			resetAccount: boolean,
		): Promise<PricingOffer | null> {
			controller?.abort();
			controller = new AbortController();
			const started = Date.now();
			const version = ++offerVersion.current;
			checkingOfferRef.current = true;
			if (resetAccount) {
				clearTimeout(expiryTimer);
				offerDeadline.current = 0;
				setOffer(null);
			}
			try {
				const response = await fetch("/api/billing/offer", {
					cache: "no-store",
					signal: AbortSignal.any([
						controller.signal,
						AbortSignal.timeout(15_000),
					]),
				});
				if (!response.ok) throw new Error("Plans unavailable");
				const next = (await response.json()) as PricingOffer;
				if (version !== offerVersion.current) return null;
				const remaining =
					Math.min(60_000, next.validForMs) - (Date.now() - started);
				if (!(remaining > 0)) throw new Error("Offer expired");
				setOffer(next);
				offerDeadline.current = Date.now() + remaining;
				clearTimeout(expiryTimer);
				expiryTimer = setTimeout(() => {
					offerDeadline.current = 0;
					setOffer(null);
				}, remaining);
				// Refresh before expiry. A slow response may retire eligibility, but
				// it never removes the public prices or changes the card structure.
				refreshTimer = setTimeout(
					() => void loadOffer(),
					Math.max(remaining / 2, remaining - 5000),
				);
				return next;
			} catch {
				if (version === offerVersion.current) {
					offerDeadline.current = 0;
					setOffer(null);
				}
				// An account lookup must never turn browsing the public catalog into
				// an error. Only an explicit checkout attempt can report its failure.
				return null;
			} finally {
				if (version === offerVersion.current) {
					checkingOfferRef.current = false;
				}
			}
		}
		requestOffer.current = () => loadOffer(false, true);
		const onFocus = () => void loadOffer(true);
		void loadOffer(true);
		window.addEventListener("focus", onFocus);
		return () => {
			clearTimeout(refreshTimer);
			clearTimeout(expiryTimer);
			controller?.abort();
			requestOffer.current = null;
			// This is a request generation, not a DOM ref: retire the latest response.
			// eslint-disable-next-line react-hooks/exhaustive-deps
			++offerVersion.current;
			window.removeEventListener("focus", onFocus);
		};
	}, [reload]);

	useEffect(() => {
		const el = sectionRef.current;
		if (!el || typeof window === "undefined") return;
		if (typeof IntersectionObserver === "undefined") {
			if (!pricingViewFired.current) {
				pricingViewFired.current = true;
				const path = window.location.pathname;
				trackConversion("cta_impression", {
					page_path: path,
					page_template: inferPageTemplateFromPath(path),
					placement: "pricing_section",
					cta_variant: "pricing_tiers_visible",
				});
			}
			return;
		}
		const ob = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting && !pricingViewFired.current) {
						pricingViewFired.current = true;
						const path = window.location.pathname;
						trackConversion("cta_impression", {
							page_path: path,
							page_template: inferPageTemplateFromPath(path),
							placement: "pricing_section",
							cta_variant: "pricing_tiers_visible",
						});
						ob.disconnect();
						break;
					}
				}
			},
			{ threshold: 0.12 },
		);
		ob.observe(el);
		return () => ob.disconnect();
	}, []);

	const handleSubscribe = async (tier: CheckoutTier) => {
		if (checkoutLock.current) return;
		checkoutLock.current = true;
		lastAttemptedTier.current = tier;
		setCheckoutError(null);
		const pagePath =
			typeof window !== "undefined" ? window.location.pathname : "/";
		const pageTemplate = inferPageTemplateFromPath(pagePath);

		setIsSubmitting(true);
		setSubmittingTier(tier);
		try {
			// Reuse a fresh prefetch, or await one shared lookup after the click.
			// A focus/account change retires this attempt, including while waiting.
			const lookup =
				!offer ||
				checkingOfferRef.current ||
				offerDeadline.current <= Date.now()
					? requestOffer.current?.()
					: null;
			const version = offerVersion.current;
			const currentOffer = lookup ? await lookup : offer;
			if (version !== offerVersion.current) {
				setCheckoutError(
					"Your account was refreshed. Please choose your plan again.",
				);
				return;
			}
			if (!currentOffer || offerDeadline.current <= Date.now()) {
				setCheckoutError(
					"Checkout is temporarily unavailable. Please try again.",
				);
				return;
			}
			if (
				offer &&
				(currentOffer.ownerUserId !== offer.ownerUserId ||
					currentOffer.action !== offer.action)
			) {
				setCheckoutError(
					"Your subscription options changed. Please choose your plan again.",
				);
				return;
			}
			if (currentOffer.action === "manage") {
				window.location.href = "/account/billing";
				return;
			}
			if (currentOffer.action === "sign_in") {
				window.location.href = `/login?next=${encodeURIComponent(`/pricing?plan=${tier}&billing=${period}`)}`;
				return;
			}
			if (!offer && currentOffer.action === "subscribe") {
				// The public button offered a trial before account eligibility loaded.
				// Show the verified paid terms and require a new, explicit choice.
				setCheckoutError(
					"A free trial is not available for this account. Review the subscription terms below before continuing.",
				);
				return;
			}
			const checkoutPrice = (
				period === "yearly" ? currentOffer.yearlyPrices : currentOffer.prices
			)?.[tier];
			const displayedPrice = displayPrices[tier];
			if (
				!checkoutPrice ||
				checkoutPrice.unitAmount !== displayedPrice.unitAmount ||
				checkoutPrice.currency.toLowerCase() !== displayedPrice.currency
			) {
				setCheckoutError(
					"Checkout for this price is temporarily unavailable. Please try again later.",
				);
				return;
			}
			trackConversion("checkout_session_started", {
				page_path: pagePath,
				page_template: pageTemplate,
				placement: "pricing_subscribe",
				plan_tier: tier,
			});
			const attribution = getSeoAttributionFields();
			const response = await fetch("/api/create-checkout-session", {
				method: "POST",
				signal: AbortSignal.timeout(45_000),
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					planCode: tier,
					billingPeriod: period,
					requestId: crypto.randomUUID(),
					expectedOwnerUserId: currentOffer.ownerUserId,
					expectedTrialOffered: currentOffer.action === "trial",
					expectedPrice: displayedPrice,
					seoLandingPath: attribution.seo_landing_path,
					checkoutPagePath: pagePath,
					seoReferrer: attribution.seo_referrer,
					seoUtm: attribution.seo_utm,
				}),
			});

			const data = (await response.json()) as {
				url?: string;
				error?: string;
				loginUrl?: string;
				kind?: "checkout" | "manage_subscription";
			};
			if (version !== offerVersion.current) {
				setCheckoutError(
					"Your account was refreshed. Please choose your plan again.",
				);
				return;
			}

			if (!response.ok) {
				if (response.status === 401 && data.loginUrl) {
					window.location.href = data.loginUrl;
					return;
				}
				const message =
					data.error ?? "Checkout could not start. Please try again.";
				trackConversion("checkout_error", {
					page_path: pagePath,
					page_template: pageTemplate,
					placement: "pricing_subscribe",
					plan_tier: tier,
					error_step: "api_response",
					status: response.status,
					message,
				});
				setCheckoutError(message);
				if (response.status === 409) setReload((n) => n + 1);
				return;
			}

			if (!data.url) {
				trackConversion("checkout_error", {
					page_path: pagePath,
					page_template: pageTemplate,
					placement: "pricing_subscribe",
					plan_tier: tier,
					error_step: "missing_checkout_url",
				});
				setCheckoutError(
					"We could not open Stripe. Refresh the page and try again.",
				);
				return;
			}

			trackConversion("checkout_redirect_success", {
				page_path: pagePath,
				page_template: pageTemplate,
				placement: "pricing_subscribe",
				plan_tier: tier,
			});

			window.location.href =
				data.kind === "manage_subscription" ? "/account/billing" : data.url;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unexpected checkout error";
			trackConversion("checkout_error", {
				page_path: pagePath,
				page_template: inferPageTemplateFromPath(
					typeof window !== "undefined" ? window.location.pathname : "/",
				),
				placement: "pricing_subscribe",
				plan_tier: tier,
				error_step: "client_exception",
				message,
			});
			setCheckoutError(
				"Network error while starting checkout. Check your connection and try again.",
			);
		} finally {
			checkoutLock.current = false;
			setIsSubmitting(false);
			setSubmittingTier(null);
		}
	};

	const isHighlighted = (tierId: PricingTierId) => tierId === "plus";

	return (
		<section
			ref={sectionRef}
			id="pricing"
			className="pricing-plans relative bg-ani-canvas py-16 lg:py-20"
		>
			<div className="container relative mx-auto px-4">
				<HomeSectionHeader
					titleAs={headingLevel === 1 ? "h1" : "h2"}
					title="Watch together. Choose your plan."
					description={
						offer?.paidHostingActive === false
							? "Join friends for free. Choose Plus or Pro for more hosting and personal watch history."
							: "Join friends for free, or host your own room with Plus or Pro."
					}
				/>
				<div
					className="pricing-plans__period"
					role="group"
					aria-label="Billing period"
				>
					{(["monthly", "yearly"] as const).map((value) => (
						<button
							key={value}
							type="button"
							aria-pressed={period === value}
							disabled={isSubmitting}
							onClick={() => {
								if (!checkoutLock.current) setPeriod(value);
							}}
						>
							{value === "monthly" ? "Monthly" : "Yearly"}
							{value === "yearly" ? <span>−20%</span> : null}
						</button>
					))}
				</div>
				<p className="pricing-plans__yearly-benefit">
					<strong>2+ months free</strong> with yearly billing
				</p>

				{checkoutError ? (
					<div
						className="mx-auto mb-8 max-w-lg rounded-[12px] border border-ani-error-text/30 bg-[var(--ani-error-bg)] px-4 py-3 text-center text-sm text-ani-error-text"
						role="alert"
					>
						{checkoutError}
						<button
							type="button"
							className="ml-2 underline underline-offset-4"
							disabled={isSubmitting}
							onClick={() =>
								lastAttemptedTier.current &&
								void handleSubscribe(lastAttemptedTier.current)
							}
						>
							Try again
						</button>
					</div>
				) : null}

				<div className="pricing-plans__grid">
					{PRICING_TIERS.map((baseTier) => {
						const tier =
							baseTier.id === "free" && offer?.paidHostingActive !== false
								? {
										...baseTier,
										audience: "Join a friend’s room for free.",
										summary: "Join a Plus, Pro or trial host for free.",
										features: [
											"Join rooms on Crunchyroll + YouTube",
											"Synced video, chat & reactions",
											"Voice & video within your host’s limits",
											"Read saved history & resume",
										],
									}
								: baseTier;
						const highlighted = isHighlighted(tier.id);
						const paidTier = tier.id !== "free" ? tier.id : null;

						return (
							<article
								key={tier.id}
								aria-labelledby={`pricing-${tier.id}-title`}
								className={`pricing-plans__card ${highlighted ? "pricing-plans__card--featured" : ""}`}
							>
								<TierCardBody
									tier={tier}
									highlighted={highlighted}
									isSubmitting={isSubmitting}
									submittingTier={submittingTier}
									paidTier={paidTier}
									onSubscribe={handleSubscribe}
									offer={offer}
									prices={displayPrices}
									period={period}
									headingLevel={headingLevel === 1 ? 2 : 3}
								/>
							</article>
						);
					})}
				</div>
				<p className="pricing-plans__terms">
					<Lock size={14} aria-hidden="true" />
					Checkout is secured by Stripe. Final total, taxes and discounts are
					shown before confirmation.
				</p>

				{showPlanMatrix ? (
					<div className="mx-auto max-w-4xl">
						<h3 className="mb-4 text-center text-lg font-semibold tracking-[-0.02em] text-ani-text">
							Plan limits at a glance
						</h3>
						<ResponsiveCompareTable
							columns={[...PRICING_PLAN_MATRIX_COLUMNS]}
							rows={PRICING_PLAN_MATRIX_ROWS.map((row) =>
								row.feature === "Price"
									? {
											...row,
											values: {
												...row.values,
												plus: displayPrices
													? period === "yearly"
														? `${formatMonthlyPrice(displayPrices.plus)}/year`
														: `${formatMonthlyPrice(displayPrices.plus)}/mo`
													: "—",
												pro: displayPrices
													? period === "yearly"
														? `${formatMonthlyPrice(displayPrices.pro)}/year`
														: `${formatMonthlyPrice(displayPrices.pro)}/mo`
													: "—",
											},
										}
									: offer?.paidHostingActive !== false
										? {
												...row,
												values: {
													...row.values,
													free:
														row.feature === "Host your own room"
															? offer
																? "Join only"
																: "Included with Plus / Pro"
															: [
																		"People in room (incl. host)",
																		"Cameras at once",
																		"Mics at once",
																	].includes(row.feature)
																? "Host’s plan"
																: row.values.free,
												},
											}
										: row,
							)}
						/>
					</div>
				) : null}
			</div>
		</section>
	);
}

function TierCardBody({
	tier,
	highlighted,
	isSubmitting,
	submittingTier,
	paidTier,
	onSubscribe,
	offer,
	prices,
	period,
	headingLevel,
}: {
	tier: (typeof PRICING_TIERS)[number];
	highlighted: boolean;
	isSubmitting: boolean;
	submittingTier: CheckoutTier | null;
	paidTier: CheckoutTier | null;
	onSubscribe: (tier: CheckoutTier) => void;
	offer: PricingOffer | null;
	prices: PricingPrices | null;
	period: BillingPeriod;
	headingLevel: 2 | 3;
}) {
	const Heading = headingLevel === 2 ? "h2" : "h3";
	const policy = getPlanPolicy(tier.id);
	const features = paidTier
		? [
				"No daily hosting limit",
				"Crunchyroll + YouTube",
				"Synced video, chat & reactions",
				`Up to ${policy.maxCameras} cameras & ${policy.maxMicrophones} mics`,
				"Save, edit & resume watch progress",
				"Friend groups & direct invitations",
				...(tier.id === "pro" ? ["Priority support"] : []),
			]
		: tier.features;
	const yearly = period === "yearly" && !!paidTier;
	const selectedPrice = paidTier && prices ? prices[paidTier] : null;
	const annualPrice = yearly ? selectedPrice : null;
	const yearlySavings = paidTier && annualPrice
		? formatMonthlyPrice({
				...annualPrice,
				unitAmount: PUBLISHED_PRICING.monthly[paidTier].unitAmount * 12 - annualPrice.unitAmount,
			})
		: null;
	const amount =
		yearly && annualPrice
			? { ...annualPrice, unitAmount: annualPrice.unitAmount / 12 }
			: selectedPrice;
	const price = amount ? formatMonthlyPrice(amount) : paidTier ? "—" : "$0";
	const ctaLabel =
		offer?.action === "trial"
			? "Start 3-day free trial"
			: offer?.action === "manage"
				? "Manage subscription"
				: offer?.action === "subscribe"
					? `Subscribe to ${tier.label}`
					: "Try 3 days free";
	const description = tier.audience;
	const recurringAmount = selectedPrice
		? formatMonthlyPrice(selectedPrice)
		: "—";
	const unit = yearly ? "year" : "month";
	const termsSummary =
		!offer || offer.action === "sign_in"
			? `Then ${recurringAmount}/${unit} automatically.`
			: offer.action === "trial"
				? `3 days free, then ${recurringAmount}/${unit} automatically.`
				: offer.action === "manage"
					? null
					: `Renews at ${recurringAmount}/${unit}.`;
	const termsDetail =
		!offer || offer.action === "sign_in" || offer.action === "trial"
			? "Card required. One trial per account. Cancel before your trial ends to avoid a charge."
			: offer.action === "manage"
				? "Manage your current plan and renewal in Account → Subscription."
				: "Cancel renewal in Account → Subscription. No new free trial is included.";

	return (
		<>
			{highlighted ? <span className="pricing-plans__badge">Recommended</span> : null}
			<div className="pricing-plans__top">
				<header className="pricing-plans__card-header">
					<Heading id={`pricing-${tier.id}-title`}>{tier.label}</Heading>
					<p className="pricing-plans__description">{description}</p>
				</header>
				<div
					className="pricing-plans__price-block"
					aria-live="polite"
					aria-atomic="true"
				>
					<div className="pricing-plans__price-line">
						<span className="pricing-plans__amount">{price}</span>
						<span className="pricing-plans__suffix">
							{!paidTier
								? "Free to join"
								: yearly
									? "per month, approx."
									: "per month"}
						</span>
					</div>
					<p className="pricing-plans__billing">
						{yearly ? (
							<>
								Billed{" "}
								<strong>{recurringAmount} / year</strong>
							</>
						) : paidTier ? (
							"Billed monthly."
						) : (
							"No card needed."
						)}
					</p>
					{yearlySavings ? (
						<p className="pricing-plans__savings">
							Save <strong>{yearlySavings} / year</strong> vs monthly
						</p>
					) : null}
				</div>
				{paidTier ? (
					<Button
						className="pricing-plans__button"
						variant={highlighted ? "cream" : "creamOutline"}
						size="control"
						onClick={() => onSubscribe(paidTier)}
						disabled={isSubmitting}
						aria-busy={isSubmitting && submittingTier === paidTier}
						aria-describedby={`pricing-${tier.id}-terms`}
					>
						{isSubmitting && submittingTier === paidTier
							? "Opening checkout…"
							: ctaLabel}
						<ArrowRight size={17} aria-hidden="true" />
					</Button>
				) : (
					<Button
						asChild
						variant="creamOutline"
						size="control"
						className="pricing-plans__button"
					>
						<Link href={INSTALL_HUB_PATH}>
							{INSTALL_CTA_LABEL}
							<ArrowRight size={17} aria-hidden="true" />
						</Link>
					</Button>
				)}
				<p
					className="pricing-plans__button-note"
					id={`pricing-${tier.id}-terms`}
				>
					{paidTier ? (
						<>
							{termsSummary ? <strong>{termsSummary}</strong> : null}
							<span>{termsDetail}</span>
						</>
					) : (
						"Install the extension, then sign in."
					)}
				</p>
			</div>
			<div className="pricing-plans__details">
				<p className="pricing-plans__feature-heading">
					{tier.id === "free" ? (
						"Everything you need to join"
					) : (
						<>Up to <strong>{policy.maxParticipants - 1} friends</strong> join free</>
					)}
				</p>
				<div>
					<FeatureList features={features} />
					{tier.id === "free" && offer?.paidHostingActive !== false ? (
						<p className="pricing-plans__free-note">
							{offer
								? "Creating rooms and saving new watch progress require Plus or Pro."
								: "Create your own rooms and save watch progress with Plus or Pro."}
						</p>
					) : null}
				</div>
			</div>
		</>
	);
}
