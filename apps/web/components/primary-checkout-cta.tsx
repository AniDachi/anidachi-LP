"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Lock } from "lucide-react";
import {
  trackConversion,
  type PageTemplateId,
  ctaCopyVariantForTemplate,
} from "@/lib/conversion-events";
import { PRICING_CTA_LABEL } from "@/lib/home-survey";
import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";

const COPY = {
  default: {
    body: "Lock in pre-launch pricing — watchrooms for Crunchyroll and YouTube.",
  },
  guide: {
    body: "Pre-launch rate locked forever — same Crunchyroll or YouTube account you already use.",
  },
  compare: {
    body: "Prices go up at public launch. Secure checkout in under a minute.",
  },
  anime: {
    body: "Start watchrooms on Crunchyroll or YouTube — each viewer keeps their own login.",
  },
  listicle: {
    body: "Subscribe before launch and keep your rate forever.",
  },
  glossary: {
    body: "Full refund before launch if it is not a fit.",
  },
  pillar: {
    body: "Lock in pre-launch pricing before we go public.",
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
    | "nav"
    | string;
  className?: string;
  ctaVariant?: string;
}

export function PrimaryCheckoutCta({
  pagePath,
  pageTemplate,
  variant: variantProp,
  placement,
  className = "",
  ctaVariant = "primary_checkout",
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
      { threshold: 0.2, rootMargin: "0px" },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [fireImpression]);

  return (
    <div
      ref={rootRef}
      className={`not-prose relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-brand-border/80 bg-brand-surface px-5 py-5 sm:px-6 ${className}`.trim()}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_80%_at_0%_0%,oklch(0.71_0.20_45_/_0.12),transparent_55%)]"
      />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1 text-left">
          <p className="text-base font-semibold tracking-[-0.01em] text-foreground">
            {PRICING_CTA_LABEL}
          </p>
          <p className="mt-0.5 text-sm leading-snug text-foreground/60">
            {copy.body}
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-foreground/45">
            <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
            Secured by Stripe
          </p>
        </div>

        <Button
          size="touch"
          className="w-full shrink-0 bg-brand-orange px-5 text-sm font-semibold text-primary-foreground transition-[transform,background-color] duration-200 ease-out hover:bg-brand-orange-deep active:scale-[0.98] sm:w-auto"
          asChild
        >
          <Link
            href="/pricing"
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
            {PRICING_CTA_LABEL}
            <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
