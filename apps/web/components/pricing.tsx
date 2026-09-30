"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Lock } from "lucide-react";
import {
	inferPageTemplateFromPath,
	trackConversion,
} from "@/lib/conversion-events";
import {
	PRICING_PLAN_MATRIX_COLUMNS,
	PRICING_PLAN_MATRIX_ROWS,
	PRICING_TIERS,
	PRICING_PLUS_MONTHLY,
	PRICING_PRO_MONTHLY,
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

// Preserve the approved local design while integration credentials are absent.
// These amounts are display-only; purchases require a fresh server offer below.
const localMonthlyPreview: PricingPrices | null =
	process.env.NODE_ENV === "development"
		? {
				plus: {
					unitAmount: Math.round(PRICING_PLUS_MONTHLY * 100),
					currency: "usd",
				},
				pro: {
					unitAmount: Math.round(PRICING_PRO_MONTHLY * 100),
					currency: "usd",
				},
			}
		: null;
const localYearlyPreview: PricingPrices | null = localMonthlyPreview
	? {
			plus: {
				...localMonthlyPreview.plus,
				unitAmount: Math.round(localMonthlyPreview.plus.unitAmount * 12 * 0.8),
			},
			pro: {
				...localMonthlyPreview.pro,
				unitAmount: Math.round(localMonthlyPreview.pro.unitAmount * 12 * 0.8),
			},
		}
	: null;

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
	initialPrices = null,
	initialYearlyPrices = null,
}: {
	/** Use 1 on the dedicated /pricing page so the page has a single H1. */
	headingLevel?: 1 | 2;
	/** Full plan-limits table — keep on `/pricing`, omit from homepage `#pricing`. */
	showPlanMatrix?: boolean;
	initialPrices?: PricingPrices | null;
	initialYearlyPrices?: PricingPrices | null;
} = {}) {
	const [selectedPeriod, setPeriod] = useState<BillingPeriod>("yearly");
	const [yearlyPrices, setYearlyPrices] = useState<PricingPrices | null>(
		initialYearlyPrices ?? localYearlyPreview,
	);
	const annualEnabled = !!yearlyPrices;
	const period: BillingPeriod = annualEnabled ? selectedPeriod : "monthly";
	const [checkoutError, setCheckoutError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submittingTier, setSubmittingTier] = useState<CheckoutTier | null>(
		null,
	);
	const sectionRef = useRef<HTMLElement | null>(null);
	const pricingViewFired = useRef(false);
	const [offer, setOffer] = useState<PricingOffer | null>(null);
	const [prices, setPrices] = useState<PricingPrices | null>(
		initialPrices ?? localMonthlyPreview,
	);
	const [checkingOffer, setCheckingOffer] = useState(true);
	const checkingOfferRef = useRef(true);
	const offerDeadline = useRef(0);
	const offerVersion = useRef(0);
	const [reload, setReload] = useState(0);
	const checkoutLock = useRef(false);
	const displayPrices = period === "yearly" ? yearlyPrices : prices;

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
		async function loadOffer(resetAccount = false) {
			clearTimeout(refreshTimer);
			// A scheduled refresh must not invalidate the explicit purchase already
			// being checked by the server. Focus/account changes still retire it.
			if (!resetAccount && checkoutLock.current) {
				refreshTimer = setTimeout(() => void loadOffer(), 1000);
				return;
			}
			controller?.abort();
			controller = new AbortController();
			const started = Date.now();
			const version = ++offerVersion.current;
			checkingOfferRef.current = true;
			setCheckingOffer(true);
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
				if (version !== offerVersion.current) return;
				const remaining =
					Math.min(60_000, next.validForMs) - (Date.now() - started);
				if (!(remaining > 0)) throw new Error("Offer expired");
				setPrices(next.prices);
				// Keep the selected period and last public amounts during a catalog outage.
				if (next.yearlyPrices) setYearlyPrices(next.yearlyPrices);
				setOffer(next);
				setCheckoutError((error) =>
					error?.startsWith("We could not load current plans") ? null : error,
				);
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
			} catch {
				if (version === offerVersion.current) {
					offerDeadline.current = 0;
					setOffer(null);
					setCheckoutError(
						"We could not load current plans. Please try again.",
					);
				}
			} finally {
				if (version === offerVersion.current) {
					checkingOfferRef.current = false;
					setCheckingOffer(false);
				}
			}
		}
		const onFocus = () => void loadOffer(true);
		void loadOffer(true);
		window.addEventListener("focus", onFocus);
		return () => {
			clearTimeout(refreshTimer);
			clearTimeout(expiryTimer);
			controller?.abort();
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
		if (!offer || checkingOfferRef.current || checkoutLock.current) return;
		const checkoutPrices =
			period === "yearly" ? offer.yearlyPrices : offer.prices;
		if (!checkoutPrices && offer.action !== "manage") return;
		if (offerDeadline.current <= Date.now()) {
			setOffer(null);
			setReload((n) => n + 1);
			return;
		}
		if (offer.action === "manage") {
			window.location.href = "/account/billing";
			return;
		}
		if (offer.action === "sign_in") {
			window.location.href = `/login?next=${encodeURIComponent(`/pricing?plan=${tier}&billing=${period}`)}`;
			return;
		}
		checkoutLock.current = true;
		const version = offerVersion.current;
		setCheckoutError(null);
		const pagePath =
			typeof window !== "undefined" ? window.location.pathname : "/";
		const pageTemplate = inferPageTemplateFromPath(pagePath);

		trackConversion("checkout_session_started", {
			page_path: pagePath,
			page_template: pageTemplate,
			placement: "pricing_subscribe",
			plan_tier: tier,
		});

		setIsSubmitting(true);
		setSubmittingTier(tier);
		try {
			const attribution = getSeoAttributionFields();
			const response = await fetch("/api/create-checkout-session", {
				method: "POST",
				signal: AbortSignal.timeout(45_000),
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					planCode: tier,
					billingPeriod: period,
					requestId: crypto.randomUUID(),
					expectedOwnerUserId: offer.ownerUserId,
					expectedTrialOffered: offer.action === "trial",
					expectedPrice: checkoutPrices![tier],
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
					title="Your next watch night starts here."
					description={
						!offer
							? "Join friends for free. Explore Plus and Pro for your own watch nights."
							: offer.paidHostingActive === false
								? "Join friends for free. Choose Plus or Pro for more hosting and personal watch history."
								: "Join friends for free. Choose Plus or Pro to host your own room and save your watch history."
					}
				/>
				{annualEnabled ? (
					<>
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
									{value === "yearly" ? <span>Save 20%</span> : null}
								</button>
							))}
						</div>
					</>
				) : null}

				{checkoutError ? (
					<div
						className="mx-auto mb-8 max-w-lg rounded-[12px] border border-ani-error-text/30 bg-[var(--ani-error-bg)] px-4 py-3 text-center text-sm text-ani-error-text"
						role="alert"
					>
						{checkoutError}
						<button
							type="button"
							className="ml-2 underline underline-offset-4"
							onClick={() => setReload((n) => n + 1)}
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
										audience: "A seat in your friends’ watch rooms",
										summary: "Join a Plus, Pro or trial host for free.",
										features: [
											"Join friends on Crunchyroll + YouTube",
											"Sync, chat & reactions",
											"Room size and media limits follow the host",
											"View saved history & resume",
											...(offer
												? ["Creating rooms & recording need Plus or Pro"]
												: []),
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
									monthlyPrices={prices}
									checkingOffer={checkingOffer}
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
																: "Checking availability"
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
	monthlyPrices,
	checkingOffer,
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
	monthlyPrices: PricingPrices | null;
	checkingOffer: boolean;
	period: BillingPeriod;
	headingLevel: 2 | 3;
}) {
	const Heading = headingLevel === 2 ? "h2" : "h3";
	const yearly = period === "yearly" && !!paidTier;
	const monthlyPrice =
		paidTier && monthlyPrices ? monthlyPrices[paidTier] : null;
	const selectedPrice = paidTier && prices ? prices[paidTier] : null;
	const annualPrice = yearly ? selectedPrice : null;
	const amount =
		yearly && annualPrice
			? { ...annualPrice, unitAmount: annualPrice.unitAmount / 12 }
			: selectedPrice;
	const price = amount ? formatMonthlyPrice(amount) : paidTier ? "—" : "$0";
	const unavailablePrice =
		(!selectedPrice || (yearly && !offer?.yearlyPrices)) &&
		offer?.action !== "manage";
	const ctaLabel =
		yearly && offer && unavailablePrice
			? "Yearly currently unavailable"
			: offer?.action === "trial"
				? "Start 3-day free trial"
				: offer?.action === "manage"
					? "Manage subscription"
					: offer?.action === "sign_in"
						? "Sign in to choose this plan"
						: offer?.action === "subscribe"
							? `Subscribe to ${tier.label}`
							: `Choose ${tier.label}`;
	const description =
		tier.id === "free"
			? tier.audience
			: tier.id === "plus"
				? "Make watch nights a regular thing."
				: "More room for your whole crew.";
	const billingNote = !paidTier
		? "Free to join. No card needed."
		: yearly
			? "One payment for the whole year."
			: offer?.action === "trial"
				? "Billed monthly after your 3-day trial."
				: "Billed monthly.";
	const recurringAmount = selectedPrice
		? formatMonthlyPrice(selectedPrice)
		: "—";
	const unit = yearly ? "year" : "month";
	const terms = !offer
		? "Your available options will appear here before checkout."
		: offer.action === "trial"
			? `Card required. 3 days free, then ${recurringAmount}/${unit} automatically. Cancel before your trial ends to avoid a charge.`
			: offer.action === "manage"
				? "Manage your current plan and renewal in Account → Subscription."
				: offer.action === "sign_in"
					? "Sign in to check your trial availability before checkout."
					: `Renews at ${recurringAmount}/${unit}. Cancel renewal in Account → Subscription. No new free trial is included.`;

	return (
		<>
			{highlighted ? (
				<span className="pricing-plans__badge">For your watch nights</span>
			) : null}
			<div className="pricing-plans__top">
				<Heading id={`pricing-${tier.id}-title`}>{tier.label}</Heading>
				<p className="pricing-plans__description">{description}</p>
				<div
					className="pricing-plans__price-block"
					aria-live="polite"
					aria-atomic="true"
				>
					<div className="pricing-plans__price-line">
						<span className="pricing-plans__amount">{price}</span>
						<span className="pricing-plans__suffix">
							{yearly ? "/mo, approx." : "/month"}
						</span>
					</div>
					<p className="pricing-plans__billing">
						{yearly && annualPrice && monthlyPrice ? (
							<>
								<strong>{formatMonthlyPrice(annualPrice)} / year</strong>
								<del
									aria-label={`12 months at monthly rate: ${formatMonthlyPrice({ ...monthlyPrice, unitAmount: monthlyPrice.unitAmount * 12 })}`}
								>
									{formatMonthlyPrice({
										...monthlyPrice,
										unitAmount: monthlyPrice.unitAmount * 12,
									})}
								</del>
							</>
						) : (
							billingNote
						)}
					</p>
				</div>
				{paidTier ? (
					<Button
						className="pricing-plans__button"
						variant={highlighted ? "cream" : "creamOutline"}
						size="control"
						onClick={() => onSubscribe(paidTier)}
						disabled={
							unavailablePrice || isSubmitting || checkingOffer || !offer
						}
						aria-busy={isSubmitting || checkingOffer}
						aria-describedby={`pricing-${tier.id}-terms`}
					>
						{isSubmitting && submittingTier === paidTier
							? "Redirecting to Stripe…"
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
					{paidTier ? terms : "Install the extension, then sign in."}
				</p>
			</div>
			<div className="pricing-plans__details">
				<p className="pricing-plans__feature-heading">
					{tier.id === "free"
						? "Watch together, for free"
						: tier.id === "plus"
							? "Your room, your watch night"
							: "Everything in Plus, with more room"}
				</p>
				<FeatureList features={tier.features} />
			</div>
		</>
	);
}
