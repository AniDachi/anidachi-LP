"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import {
  trackConversion,
  type PageTemplateId,
  ctaCopyVariantForTemplate,
} from "@/lib/conversion-events";
import { INSTALL_CTA_LABEL, INSTALL_HUB_PATH } from "@/lib/install-cta";

const COPY = {
  default: {
    body: "Install the Chrome extension in about 2 minutes — Crunchyroll and YouTube watchrooms.",
  },
  guide: {
    body: "Download AniDachi for Chrome, then host on the same Crunchyroll or YouTube account you already use.",
  },
  compare: {
    body: "Install the official zip while the Chrome Web Store listing goes through review.",
  },
  anime: {
    body: "Install AniDachi, open the title on Crunchyroll or YouTube, and start a watchroom.",
  },
  listicle: {
    body: "Get the Chrome extension first — Plus and Pro are optional upgrades after you host.",
  },
  glossary: {
    body: "Install on desktop Chrome, then upgrade only if you need larger rooms.",
  },
  pillar: {
    body: "Download the official zip from AniDachi, Load unpacked, then create a watchroom.",
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
  ctaVariant = "primary_install",
}: PrimaryCheckoutCtaProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const impressionFired = useRef(false);
  const key =
    variantProp ??
    (pageTemplate === "install"
      ? "default"
      : ctaCopyVariantForTemplate(pageTemplate));
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
      className={`not-prose relative mx-auto w-full max-w-4xl overflow-hidden rounded-[20px] border border-ani-line bg-ani-panel px-5 py-5 sm:px-6 ${className}`.trim()}
    >
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1 text-left">
          <p className="text-base font-semibold tracking-[-0.02em] text-ani-text">
            {INSTALL_CTA_LABEL}
          </p>
          <p className="mt-0.5 text-sm leading-snug text-ani-muted">
            {copy.body}
          </p>
        </div>

        <Button
          variant="cream"
          size="control"
          className="w-full shrink-0 sm:w-auto"
          asChild
        >
          <Link
            href={INSTALL_HUB_PATH}
            onClick={() => {
              trackConversion("cta_click", {
                page_path: pagePath,
                page_template: pageTemplate,
                placement,
                cta_variant: ctaVariant,
              });
            }}
          >
            {INSTALL_CTA_LABEL}
            <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
