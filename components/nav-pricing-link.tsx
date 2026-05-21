"use client";

import Link from "next/link";
import {
  inferPageTemplateFromPath,
  trackConversion,
} from "@/lib/conversion-events";
import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";

export function NavPricingLink({
  className = "text-purple-100 hover:text-white transition-colors",
}: {
  className?: string;
}) {
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
          placement: "nav",
          cta_variant: "nav_pricing",
        });
        openSurvey({ placement: "nav", ctaVariant: "nav_pricing" });
      }}
    >
      Pick a plan
    </Link>
  );
}
