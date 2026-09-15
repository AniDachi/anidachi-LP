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
  pricingCheckoutCtaLabel,
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
  const [submittingTier, setSubmittingTier] = useState<CheckoutTier | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const pricingViewFired = useRef(false);

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
      { threshold: 0.12 }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  const handleSubscribe = async (tier: CheckoutTier) => {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode: tier,
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
      };

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
          "We could not open Stripe. Refresh the page and try again."
        );
        return;
      }

      trackConversion("checkout_redirect_success", {
        page_path: pagePath,
        page_template: pageTemplate,
        placement: "pricing_subscribe",
        plan_tier: tier,
      });

      window.location.href = data.url;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected checkout error";
      trackConversion("checkout_error", {
        page_path: pagePath,
        page_template: inferPageTemplateFromPath(
          typeof window !== "undefined" ? window.location.pathname : "/"
        ),
        placement: "pricing_subscribe",
        plan_tier: tier,
        error_step: "client_exception",
        message,
      });
      setCheckoutError(
        "Network error while starting checkout. Check your connection and try again."
      );
    } finally {
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
          title="Host more. Install is free."
          description="Download the Chrome extension first. Free joins any room. Plus and Pro raise your host limits and unlock personal history."
        />

        {checkoutError ? (
          <div
            className="mx-auto mb-8 max-w-lg rounded-[12px] border border-ani-error-text/30 bg-[var(--ani-error-bg)] px-4 py-3 text-center text-sm text-ani-error-text"
            role="alert"
          >
            {checkoutError}
          </div>
        ) : null}

        <div className="mx-auto mb-12 grid max-w-6xl items-stretch gap-6 pt-2 md:grid-cols-3 lg:gap-8">
          {PRICING_TIERS.map((tier) => {
            const highlighted = isHighlighted(tier.id);
            const paidTier = tier.id !== "free" ? tier.id : null;

            return (
              <div key={tier.id} className="flex h-full flex-col">
                <Card
                  className={`flex h-full flex-1 flex-col gap-0 rounded-[20px] border bg-ani-panel p-6 shadow-none ${
                    highlighted
                      ? "border-ani-control-border"
                      : "border-ani-line"
                  }`}
                >
                  <TierCardBody
                    tier={tier}
                    highlighted={highlighted}
                    isSubmitting={isSubmitting}
                    submittingTier={submittingTier}
                    paidTier={paidTier}
                    onSubscribe={handleSubscribe}
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
              rows={PRICING_PLAN_MATRIX_ROWS}
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
}: {
  tier: (typeof PRICING_TIERS)[number];
  highlighted: boolean;
  isSubmitting: boolean;
  submittingTier: CheckoutTier | null;
  paidTier: CheckoutTier | null;
  onSubscribe: (tier: CheckoutTier) => void;
}) {
  const badgeLabel = tier.id === "plus" ? "Most Popular" : null;

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
            className={`px-5 py-1.5 text-sm font-semibold ${
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
          <Badge className="px-5 py-1.5 text-sm font-semibold">Placeholder</Badge>
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
          <span className="text-5xl font-semibold text-ani-text">{tier.priceDisplay}</span>
          {tier.priceSuffix ? (
            <span className="ml-1 text-lg text-ani-muted">{tier.priceSuffix}</span>
          ) : null}
        </div>
        <CardDescription className="min-h-[4.5rem] text-base text-ani-muted">
          {tier.summary}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col p-0">
        <FeatureList features={tier.features} />

        <div className="mt-auto pt-2">
          {paidTier ? (
            <Button
              className="w-full"
              variant={tier.id === "plus" ? "cream" : "creamOutline"}
              size="control"
              onClick={() => onSubscribe(paidTier)}
              disabled={isSubmitting}
            >
              {isSubmitting && submittingTier === paidTier
                ? "Redirecting to Stripe…"
                : pricingCheckoutCtaLabel(paidTier)}
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
        </div>
      </CardContent>
    </>
  );
}
