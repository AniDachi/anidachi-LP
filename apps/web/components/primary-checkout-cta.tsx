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
    title: "Get early access and lock in your price",
    body: "Pre-launch pricing on Stripe — subscribe now and keep your rate forever. Full refund if you change your mind.",
    button: "Get early access",
  },
  guide: {
    title: "Join early access and lock in your rate",
    body: "Pre-launch pricing only available before we launch. Same Crunchyroll account you already use — cancel or refund on your terms.",
    button: "Get early access",
  },
  compare: {
    title: "Lock in pre-launch pricing today",
    body: "Get early access before public launch — prices go up when we ship. Secure Stripe checkout in under a minute.",
    button: "Get early access",
  },
  anime: {
    title: "Get early access for your watchroom",
    body: "Lock in pre-launch pricing, then open any title on Crunchyroll in an AniDachi room. Each viewer keeps their own login.",
    button: "Get early access",
  },
  listicle: {
    title: "Lock in early-access pricing for your group",
    body: "Subscribe before launch and keep your rate forever — then start watchrooms on any Crunchyroll title.",
    button: "Get early access",
  },
  glossary: {
    title: "Early access with a clear refund path",
    body: "Lock in pre-launch pricing on Stripe — cancel or get a full refund if it is not a fit.",
    button: "Get early access",
  },
  pillar: {
    title: "Get early access and lock in your price",
    body: "Pre-launch pricing on Stripe — subscribe now and keep your rate forever. Full refund if you change your mind.",
    button: "Get early access",
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
  trustMicrocopyClassName?: string;
}

export function PrimaryCheckoutCta({
  pagePath,
  pageTemplate,
  variant: variantProp,
  placement,
  className = "",
  ctaVariant = "primary_checkout",
  trustMicrocopyClassName = "text-sm text-foreground/50 mt-4 max-w-md mx-auto flex items-start justify-center gap-2",
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
      className={`p-8 bg-[--brand-surface] border border-[--brand-border] rounded-xl text-center ${className}`.trim()}
    >
      <h3 className="text-2xl font-bold text-foreground mb-3">{copy.title}</h3>
      <p className="text-foreground/70 mb-6 max-w-lg mx-auto">{copy.body}</p>
      <Button
        size="lg"
        className="bg-[--brand-orange] hover:bg-[--brand-orange-deep] text-[--primary-foreground] glow-orange"
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
        <span>
          Secure checkout via Stripe. Crunchyroll subscription not included —
          everyone keeps their own streaming login.
        </span>
      </p>
    </div>
  );
}
