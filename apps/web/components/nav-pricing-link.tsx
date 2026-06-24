"use client";

import {
  inferPageTemplateFromPath,
  trackConversion,
} from "@/lib/conversion-events";
import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";

export function NavPricingLink({
  className = "text-foreground/70 hover:text-brand-orange-bright transition-colors",
}: {
  className?: string;
}) {
  const { openSurvey } = usePlanSurvey();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (typeof window === "undefined") return;
        const path = window.location.pathname;
        trackConversion("cta_click", {
          page_path: path,
          page_template: inferPageTemplateFromPath(path),
          placement: "nav",
          cta_variant: "nav_pricing",
        });
        openSurvey({ placement: "nav", ctaVariant: "nav_pricing" });
      }}
    >
      Get early access
    </button>
  );
}
