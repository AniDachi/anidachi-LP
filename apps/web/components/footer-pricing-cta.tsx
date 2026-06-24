"use client";

import Link from "next/link";
import { inferPageTemplateFromPath, trackConversion } from "@/lib/conversion-events";
import { PRICING_CTA_LABEL } from "@/lib/home-survey";
import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";

export function FooterPricingCta({ className = "" }: { className?: string }) {
  const { openSurvey } = usePlanSurvey();

  return (
    <Link
      href="/#pricing"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        if (typeof window === "undefined") return;
        const path = window.location.pathname;
        trackConversion("cta_click", {
          page_path: path,
          page_template: inferPageTemplateFromPath(path),
          placement: "footer",
          cta_variant: "footer_pricing",
        });
        openSurvey({ placement: "footer", ctaVariant: "footer_pricing" });
      }}
    >
      {PRICING_CTA_LABEL}
    </Link>
  );
}
