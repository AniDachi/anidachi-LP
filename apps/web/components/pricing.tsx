"use client";

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
import { Check, Star, Zap, Lock } from "lucide-react";
import {
  inferPageTemplateFromPath,
  trackConversion,
} from "@/lib/conversion-events";
import type { CheckoutTier, HomeSurveyAnswers } from "@/lib/home-survey";
import { PRICING_CTA_LABEL } from "@/lib/home-survey";
import { PricingSurveyLink } from "@/components/pricing-survey-link";

export function Pricing({
  survey,
  recommendedTier,
  getCtaLabelForTier,
}: {
  survey?: HomeSurveyAnswers;
  recommendedTier?: CheckoutTier;
  getCtaLabelForTier?: (tier: CheckoutTier) => string;
} = {}) {
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      recommended_tier: recommendedTier ?? "unset",
      segment: survey?.segment ?? "unset",
      priority: survey?.priority ?? "unset",
    });

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode: tier }),
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
    }
  };

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="relative overflow-hidden bg-background py-16 lg:py-20"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[600px] h-[400px] bg-brand-orange/8 blur-[100px]"
        aria-hidden
      />
      <div className="container mx-auto px-4 relative">
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-orange/30 bg-brand-orange/15 px-4 py-2 text-sm font-medium text-brand-orange">
            <Zap className="h-4 w-4" aria-hidden="true" />
            Pre-Launch Pricing
          </div>
          <h2 className="mb-3 text-3xl font-bold text-foreground md:text-5xl">
            Pre-launch pricing. Locked in forever.
          </h2>
          <div className="mx-auto mb-3 h-0.5 w-12 rounded-full bg-gradient-to-r from-brand-orange to-brand-orange-bright" />
          <p className="mx-auto max-w-xl text-base text-foreground/70">
            Subscribe before launch — your rate stays forever.
          </p>

          {checkoutError && (
            <div
              className="mx-auto mb-6 mt-4 max-w-lg rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {checkoutError}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto mb-12 items-stretch pt-6">
          <div className="flex flex-col h-full animate-fade-in-up">
            <div className="flex flex-1 flex-col rounded-xl p-[2px] animated-gradient-border">
              <Card className="flex h-full flex-1 flex-col gap-0 border-0 bg-brand-surface p-6 shadow-xl rounded-[calc(var(--radius-xl)-2px)]">
                <div className="mb-5 flex min-h-8 items-center justify-center">
                  <Badge className="bg-brand-orange px-5 py-1.5 text-sm font-semibold text-primary-foreground shadow-md">
                    <Star className="mr-1 h-3 w-3" aria-hidden="true" />
                    {recommendedTier === "plus"
                      ? "Recommended"
                      : "Most Popular"}
                  </Badge>
                </div>

                <CardHeader className="space-y-2 p-0 pb-5 text-center">
                  <CardTitle className="text-2xl font-bold text-foreground">
                    Plus
                  </CardTitle>
                  <p className="min-h-[4.5rem] text-sm font-medium leading-snug text-brand-orange-bright">
                    Who it&apos;s for: regular watch nights with friends, sync,
                    chat, and shared progress
                  </p>
                  <div className="flex items-baseline justify-center pt-1">
                    <span className="text-5xl font-bold text-foreground">$7.99</span>
                    <span className="ml-1 text-lg text-foreground/60">/month</span>
                  </div>
                  <CardDescription className="min-h-[4.5rem] text-base text-foreground/70">
                    Host rooms without the free time limit, invite friends, and use
                    up to 4 video seats
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col p-0">
                  <ul className="mb-6 flex-1 space-y-2">
                    {[
                      "Unlimited watchrooms",
                      "Real-time chat & discussions",
                      "Chrome extension access",
                      "Cross-device playback sync",
                      "Watch history & progress tracking",
                      "Priority support",
                    ].map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check
                          className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-orange"
                          aria-hidden="true"
                        />
                        <span className="text-sm text-foreground/80">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-2">
                    <Button
                      className="w-full py-4 text-lg font-semibold bg-brand-orange text-primary-foreground shadow-lg glow-orange transition-all duration-300 hover:bg-brand-orange-deep hover:glow-orange-lg disabled:opacity-60"
                      onClick={() => handleSubscribe("plus")}
                      disabled={isSubmitting}
                    >
                      {isSubmitting
                        ? "Redirecting to Stripe…"
                        : (getCtaLabelForTier?.("plus") ?? PRICING_CTA_LABEL)}
                    </Button>
                    <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-foreground/50">
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                      Secured by Stripe
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div
            className="flex h-full flex-col animate-fade-in-up"
            style={{ animationDelay: "100ms" }}
          >
            <Card
              className={`flex h-full flex-1 flex-col gap-0 border bg-brand-surface p-6 shadow-xl transition-all duration-300 hover:border-brand-orange/40 hover:shadow-lg ${
                recommendedTier === "pro"
                  ? "border-brand-orange/40 ring-2 ring-brand-orange/30"
                  : "border-brand-border"
              }`}
            >
              <div
                className="mb-5 flex min-h-8 items-center justify-center opacity-0 pointer-events-none"
                aria-hidden
              >
                <Badge className="px-5 py-1.5 text-sm font-semibold">
                  Placeholder
                </Badge>
              </div>

              <CardHeader className="space-y-2 p-0 pb-5 text-center">
                <CardTitle className="text-2xl font-bold text-foreground">
                  Pro
                </CardTitle>
                <p className="min-h-[4.5rem] text-sm font-medium leading-snug text-brand-orange-bright">
                  Who it&apos;s for: club hosts and bigger groups who need
                  private rooms, moderator controls, and room personalization
                </p>
                <div className="flex items-baseline justify-center pt-1">
                  <span className="text-5xl font-bold text-foreground">$14.99</span>
                  <span className="ml-1 text-lg text-foreground/60">/month</span>
                </div>
                <CardDescription className="min-h-[4.5rem] text-base text-foreground/70">
                  For bigger groups: more participants, more groups, longer
                  history, and the same lightweight 4-seat video limit.
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col p-0">
                <ul className="mb-6 flex-1 space-y-2">
                  {[
                    "Everything in Plus",
                    "Invite-only rooms (private links + approval)",
                    "Host & moderator controls (kick/ban, lock playback, room rules)",
                    "Room personalization (name, cover, pinned notes)",
                    "Founder badge + early feature drops",
                    "Fast-track support (same-day replies)",
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check
                        className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-orange"
                        aria-hidden="true"
                      />
                      <span className="text-sm text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-2">
                  <Button
                    variant="outline"
                    className="w-full border-brand-orange/50 py-4 text-lg font-semibold text-brand-orange transition-all duration-300 hover:border-brand-orange hover:bg-brand-orange hover:text-primary-foreground disabled:opacity-60"
                    onClick={() => handleSubscribe("pro")}
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? "Redirecting to Stripe…"
                      : (getCtaLabelForTier?.("pro") ?? PRICING_CTA_LABEL)}
                  </Button>
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-foreground/50">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    Secured by Stripe
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <p className="text-center mt-8">
          <PricingSurveyLink />
        </p>
      </div>
    </section>
  );
}
