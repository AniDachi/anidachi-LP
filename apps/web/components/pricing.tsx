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
import { Check, Star, Zap, Shield, Lock, CreditCard } from "lucide-react";
import {
  inferPageTemplateFromPath,
  trackConversion,
} from "@/lib/conversion-events";
import type { CheckoutTier, HomeSurveyAnswers } from "@/lib/home-survey";
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
      className="py-24 bg-gradient-to-br from-gray-50 to-white"
    >
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Zap className="w-4 h-4" aria-hidden="true" />
            Pre-Launch Pricing
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
            Pre-launch pricing. Locked in forever.
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
            These prices are only available before we launch. Subscribe now and
            lock in your rate permanently — prices go up at public launch. Full
            refund before launch if you change your mind.
          </p>

          {checkoutError && (
            <div
              className="max-w-lg mx-auto mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {checkoutError}
            </div>
          )}

          <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-gray-500 mb-8">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" aria-hidden="true" />
              <span>Secure payments via Stripe</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4" aria-hidden="true" />
              <span>Cancel &amp; refund anytime</span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-12 items-stretch">
          <Card
            className={`relative order-1 border-2 shadow-xl md:scale-105 bg-gradient-to-br from-purple-50 to-white transition-all duration-300 hover:shadow-2xl px-6 py-8 z-10 ${
              recommendedTier === "plus"
                ? "border-purple-600 ring-4 ring-purple-100"
                : "border-purple-500"
            }`}
          >
            <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 text-sm font-semibold">
                <Star className="w-3 h-3 mr-1" aria-hidden="true" />
                {recommendedTier === "plus"
                  ? "Recommended"
                  : "Most Popular"}
              </Badge>
            </div>

            <CardHeader className="text-center pt-6 pb-4">
              <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
                Plus
              </CardTitle>
              <p className="text-sm font-medium text-purple-800 mb-2">
                Who it&apos;s for: regular watch nights with friends, sync,
                chat, and shared progress
              </p>
              <div className="flex items-baseline justify-center mb-2">
                <span className="text-5xl font-bold text-gray-900">$7.99</span>
                <span className="text-gray-600 ml-1 text-lg">/month</span>
              </div>
              <CardDescription className="text-gray-600 text-base">
                Host rooms without the free time limit, invite friends, and use
                up to 4 video seats
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 px-6 pb-6">
              <ul className="space-y-2 mb-4">
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
                      className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-4">
                <Button
                  className="w-full py-4 text-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-60"
                  onClick={() => handleSubscribe("plus")}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Redirecting to Stripe…"
                    : (getCtaLabelForTier?.("plus") ?? "Start Plus")}
                </Button>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    Secured by Stripe
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                    Card checkout
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Pre-launch rate locked forever &bull; Cancel anytime &bull; Full refund before launch
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`relative order-2 border bg-white transition-all duration-300 px-6 py-8 md:opacity-95 md:scale-[0.99] hover:shadow-lg ${
              recommendedTier === "pro"
                ? "border-gray-900 ring-4 ring-gray-200"
                : "border-gray-200"
            }`}
          >
            <CardHeader className="text-center pt-6 pb-4">
              <CardTitle className="text-2xl font-bold text-gray-700 mb-2">
                Pro
              </CardTitle>
              <div className="flex items-baseline justify-center mb-2">
                <span className="text-5xl font-bold text-gray-900">$14.99</span>
                <span className="text-gray-600 ml-1 text-lg">/month</span>
              </div>
              <CardDescription className="text-gray-500 text-base">
                For bigger groups: more participants, more groups, longer
                history, and the same lightweight 4-seat video limit.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 px-6 pb-6">
              <ul className="space-y-2 mb-4">
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
                      className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-4">
                <Button
                  className="w-full py-4 text-lg font-semibold bg-gray-900 hover:bg-gray-950 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-60"
                  onClick={() => handleSubscribe("pro")}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Redirecting to Stripe…"
                    : (getCtaLabelForTier?.("pro") ?? "Start Pro")}
                </Button>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    Secured by Stripe
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                    Card checkout
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Pre-launch rate locked forever &bull; Cancel anytime &bull; Full refund before launch
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-center mt-8">
          <PricingSurveyLink />
        </p>
      </div>
    </section>
  );
}
