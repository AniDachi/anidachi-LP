"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield } from "lucide-react";
import {
  trackConversion,
  type PageTemplateId,
  ctaCopyVariantForTemplate,
} from "@/lib/conversion-events";
import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";

const COPY = {
  default: {
    title: "We’ll help you pick the right plan",
    body: "$8/mo (early access) · Billed by Stripe. Full refund if you change your mind — no hidden fees.",
    button: "Help me pick a plan",
  },
  guide: {
    title: "Not sure which plan fits?",
    body: "Same Crunchyroll account you already use. Checkout takes under a minute; cancel or refund on your terms.",
    button: "Help me pick a plan",
  },
  compare: {
    title: "Pick a plan in under a minute",
    body: "Compare plans on the home page, then start a secure Stripe checkout when you are ready.",
    button: "Help me pick a plan",
  },
  anime: {
    title: "We’ll help you pick a plan for your watchroom",
    body: "Unlimited watchrooms, sync, and chat on Crunchyroll. Each viewer still needs their own Crunchyroll access.",
    button: "Help me pick a plan",
  },
  listicle: {
    title: "Pick a plan for your group",
    body: "Lock in early-access pricing, then open any title on Crunchyroll in an AniDachi room.",
    button: "Help me pick a plan",
  },
  glossary: {
    title: "Pick a plan with a clear refund path",
    body: "Early-access pricing with Stripe — cancel or refund if it is not a fit.",
    button: "Help me pick a plan",
  },
  pillar: {
    title: "We’ll help you pick a plan",
    body: "Founding-member pricing on Stripe. Refund if you are not happy — we built this for long-running anime groups.",
    button: "Help me pick a plan",
  },
} as const;

type CtaCopyKey = keyof typeof COPY;

export interface PrimaryCheckoutCtaProps {
  pagePath: string;
  pageTemplate: PageTemplateId;
  /** Maps to COPY key; default: derived from `pageTemplate` */
  variant?: CtaCopyKey;
  placement:
    | "content_above_fold"
    | "content_bottom"
    | "content_mid"
    | "hero"
    | "home_features"
    | "nav";
  className?: string;
  ctaVariant?: string;
  trustMicrocopyClassName?: string;
}

export function PrimaryCheckoutCta({
  pagePath,
  pageTemplate,
  variant: variantProp,
  placement,
  className = "",
  ctaVariant = "primary_checkout",
  trustMicrocopyClassName = "text-sm text-gray-500 mt-4 max-w-md mx-auto flex items-start justify-center gap-2",
}: PrimaryCheckoutCtaProps) {
  const { openSurvey } = usePlanSurvey();
  const rootRef = useRef<HTMLDivElement>(null);
  const impressionFired = useRef(false);
  const key = variantProp ?? ctaCopyVariantForTemplate(pageTemplate);
  const copy = COPY[key] ?? COPY.default;

  const fireImpression = useCallback(() => {
    if (impressionFired.current) return;
    impressionFired.current = true;
    trackConversion("cta_impression", {
      page_path: pagePath,
      page_template: pageTemplate,
      placement,
      cta_variant: ctaVariant,
    });
  }, [pagePath, pageTemplate, placement, ctaVariant]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      fireImpression();
      return;
    }

    const ob = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            fireImpression();
            ob.disconnect();
            break;
          }
        }
      },
      { threshold: 0.2, rootMargin: "0px" }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [fireImpression]);

  return (
    <div
      ref={rootRef}
      className={`p-8 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl text-center ${className}`.trim()}
    >
      <h3 className="text-2xl font-bold text-gray-900 mb-3">{copy.title}</h3>
      <p className="text-gray-600 mb-6 max-w-lg mx-auto">{copy.body}</p>
      <Button
        size="lg"
        className="bg-purple-600 hover:bg-purple-700 text-white"
        asChild
      >
        <Link
          href="/#pricing"
          onClick={(e) => {
            e.preventDefault();
            trackConversion("cta_click", {
              page_path: pagePath,
              page_template: pageTemplate,
              placement,
              cta_variant: ctaVariant,
            });
            openSurvey({ placement, ctaVariant });
          }}
        >
          {copy.button}
          <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
        </Link>
      </Button>
      <p className={trustMicrocopyClassName}>
        <Shield
          className="h-4 w-4 flex-shrink-0 text-green-600 mt-0.5"
          aria-hidden="true"
        />
        <span>Secure checkout via Stripe. Crunchyroll subscription not included — everyone keeps their own streaming login.</span>
      </p>
    </div>
  );
}
