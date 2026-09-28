"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Lock } from "lucide-react";
import {
	inferPageTemplateFromPath,
	trackConversion,
} from "@/lib/conversion-events";
import {
	PRICING_PLAN_MATRIX_COLUMNS,
	PRICING_PLAN_MATRIX_ROWS,
	PRICING_TIERS,
	type CheckoutTier,
	type PricingTierId,
} from "@/lib/pricing-tiers";
import { INSTALL_CTA_LABEL, INSTALL_HUB_PATH } from "@/lib/install-cta";
import { HomeSectionHeader } from "@/components/home-section-header";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { getSeoAttributionFields } from "@/lib/seo-landing-path";
import type { PricingOffer } from "@/lib/pricing-offer";
import { formatMonthlyPrice } from "@/lib/billing-view";

function FeatureList({ features }: { features: string[] }) {
	return (
		<ul className="mb-6 flex-1 space-y-2">
			{features.map((feature) => (
				<li key={feature} className="flex items-start gap-3">
					<Check
						className="mt-0.5 h-5 w-5 flex-shrink-0 text-ani-progress"
						aria-hidden="true"
					/>
					<span className="text-sm text-ani-muted">{feature}</span>
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
	const [checkoutError, setCheckoutError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submittingTier, setSubmittingTier] = useState<CheckoutTier | null>(
		null,
	);
	const sectionRef = useRef<HTMLElement | null>(null);
	const pricingViewFired = useRef(false);
	const [offer, setOffer] = useState<PricingOffer | null>(null);
	const offerVersion = useRef(0);
	const [reload, setReload] = useState(0);
	const checkoutLock = useRef(false);

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		async function loadOffer() {
			clearTimeout(timer);
			const started = Date.now();
			const version = ++offerVersion.current;
			setOffer(null);
			try {
				const response = await fetch("/api/billing/offer", {
					cache: "no-store",
					signal: AbortSignal.timeout(15_000),
				});
				if (!response.ok) throw new Error("Plans unavailable");
				const next = (await response.json()) as PricingOffer;
				if (version !== offerVersion.current) return;
				const remaining =
					Math.min(60_000, next.validForMs) - (Date.now() - started);
				if (!(remaining > 0)) throw new Error("Offer expired");
				setOffer(next);
				setCheckoutError(null);
				timer = setTimeout(() => void loadOffer(), remaining);
			} catch {
				if (version === offerVersion.current)
					setCheckoutError(
						"We could not load current plans. Please try again.",
					);
			}
		}
		void loadOffer();
		window.addEventListener("focus", loadOffer);
		return () => {
			clearTimeout(timer);
			++offerVersion.current;
			window.removeEventListener("focus", loadOffer);
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
		if (!offer || checkoutLock.current) return;
		if (offer.action === "manage") {
			window.location.href = "/account/billing";
			return;
		}
		if (offer.action === "sign_in") {
			window.location.href = `/login?next=${encodeURIComponent(`/pricing?plan=${tier}`)}`;
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
			const latestResponse = await fetch("/api/billing/offer", {
				cache: "no-store",
			});
			if (!latestResponse.ok) throw new Error("Offer verification unavailable");
			const latest = (await latestResponse.json()) as PricingOffer;
			if (version !== offerVersion.current) return;
			if (
				latest.ownerUserId !== offer.ownerUserId ||
				latest.action !== offer.action ||
				JSON.stringify(latest.prices[tier]) !==
					JSON.stringify(offer.prices[tier])
			) {
				setOffer(latest);
				setCheckoutError(
					"Your account or offer changed. Review the current plans before continuing.",
				);
				return;
			}
			const attribution = getSeoAttributionFields();
			const response = await fetch("/api/create-checkout-session", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					planCode: tier,
					requestId: crypto.randomUUID(),
					expectedOwnerUserId: offer.ownerUserId,
					expectedTrialOffered: offer.action === "trial",
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
			if (version !== offerVersion.current) return;

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
			className="relative overflow-hidden bg-ani-canvas py-16 lg:py-20"
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

				<div className="mx-auto mb-12 grid max-w-6xl items-stretch gap-6 pt-2 lg:grid-cols-3 lg:gap-8">
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
							<div key={tier.id} className="flex h-full flex-col">
								<Card
									className={`flex h-full flex-1 flex-col gap-0 rounded-[20px] border bg-ani-panel p-6 shadow-none ${
										highlighted ? "border-ani-primary" : "border-ani-line"
									}`}
								>
									<TierCardBody
										tier={tier}
										highlighted={highlighted}
										isSubmitting={isSubmitting}
										submittingTier={submittingTier}
										paidTier={paidTier}
										onSubscribe={handleSubscribe}
										offer={offer}
									/>
								</Card>
							</div>
						);
					})}
				</div>

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
												plus: offer
													? `${formatMonthlyPrice(offer.prices.plus)}/mo`
													: "—",
												pro: offer
													? `${formatMonthlyPrice(offer.prices.pro)}/mo`
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
}: {
	tier: (typeof PRICING_TIERS)[number];
	highlighted: boolean;
	isSubmitting: boolean;
	submittingTier: CheckoutTier | null;
	paidTier: CheckoutTier | null;
	onSubscribe: (tier: CheckoutTier) => void;
	offer: PricingOffer | null;
}) {
	const badgeLabel = tier.id === "plus" ? "Regular watch nights" : null;
	const ctaLabel =
		offer?.action === "trial"
			? "Start 3-day free trial"
			: offer?.action === "manage"
				? "Manage subscription"
				: offer?.action === "sign_in"
					? "Sign in to choose this plan"
					: offer?.action === "subscribe"
						? `Subscribe to ${tier.label}`
						: "Checking availability…";
	const price =
		paidTier && offer
			? formatMonthlyPrice(offer.prices[paidTier])
			: paidTier
				? "—"
				: "$0";

	return (
		<>
			<div
				className={`mb-5 flex min-h-8 items-center justify-center ${
					badgeLabel ? "" : "opacity-0 pointer-events-none"
				}`}
				aria-hidden={!badgeLabel}
			>
				{badgeLabel ? (
					<Badge
						className={`px-3 py-1.5 text-sm font-semibold ${
							highlighted
								? "rounded-full border-transparent bg-ani-primary text-ani-on-primary shadow-none"
								: "rounded-full border border-ani-control-border bg-transparent text-ani-text"
						}`}
					>
						{highlighted ? (
							<Star className="mr-1 h-3 w-3" aria-hidden="true" />
						) : null}
						{badgeLabel}
					</Badge>
				) : (
					<Badge className="px-5 py-1.5 text-sm font-semibold">
						Placeholder
					</Badge>
				)}
			</div>

			<CardHeader className="space-y-2 p-0 pb-5 text-center">
				<CardTitle className="text-2xl font-semibold text-ani-text">
					{tier.label}
				</CardTitle>
				<p className="min-h-[4.5rem] text-sm font-medium leading-snug text-ani-muted">
					{tier.audience}
				</p>
				<div className="flex items-baseline justify-center pt-1">
					<span className="text-5xl font-semibold text-ani-text">{price}</span>
					{tier.priceSuffix ? (
						<span className="ml-1 text-lg text-ani-muted">
							{tier.priceSuffix}
						</span>
					) : null}
				</div>
				<CardDescription className="min-h-[4.5rem] text-base text-ani-muted">
					{tier.summary}
				</CardDescription>
			</CardHeader>

			<CardContent className="flex flex-1 flex-col p-0">
				<div className="border-b border-ani-line pb-6 mb-6">
					{paidTier ? (
						<Button
							className="w-full"
							variant={tier.id === "plus" ? "cream" : "creamOutline"}
							size="control"
							onClick={() => onSubscribe(paidTier)}
							disabled={isSubmitting || !offer}
						>
							{isSubmitting && submittingTier === paidTier
								? "Redirecting to Stripe…"
								: ctaLabel}
						</Button>
					) : (
						<Button asChild variant="cream" size="control" className="w-full">
							<Link href={INSTALL_HUB_PATH}>{INSTALL_CTA_LABEL}</Link>
						</Button>
					)}
					<p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ani-muted">
						{paidTier ? (
							<>
								<Lock className="h-3.5 w-3.5" aria-hidden="true" />
								Secured by Stripe
							</>
						) : (
							"Install the extension, then sign in"
						)}
					</p>
					{paidTier && offer ? (
						<p className="mt-3 min-h-16 text-center text-xs leading-relaxed text-ani-muted">
							{offer.action === "trial"
								? `Card required. 3 days free, then ${price}/month automatically. Cancel renewal in Account → Subscription before your trial ends to avoid the first charge.`
								: offer.action === "manage"
									? "Your existing subscription is managed in your account."
									: offer.action === "sign_in"
										? "Sign in to check your trial availability. Review the price and payment schedule before confirming in Stripe."
										: `Billed monthly at ${price}. Cancel renewal in Account → Subscription. No new free trial is included.`}
							{offer.action !== "manage"
								? " Final total and applicable taxes or discounts are shown in Stripe."
								: ""}
						</p>
					) : null}
				</div>
				<FeatureList features={tier.features} />
			</CardContent>
		</>
	);
}
