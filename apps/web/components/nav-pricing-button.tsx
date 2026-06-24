"use client";

import { Button } from "@/components/ui/button";
import {
  inferPageTemplateFromPath,
  trackConversion,
} from "@/lib/conversion-events";
import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";

export function NavPricingButton() {
  const { openSurvey } = usePlanSurvey();
  return (
    <Button
      type="button"
      size="sm"
      className="bg-white text-purple-800 hover:bg-purple-50 font-semibold"
      onClick={() => {
        if (typeof window === "undefined") return;
        const path = window.location.pathname;
        trackConversion("cta_click", {
          page_path: path,
          page_template: inferPageTemplateFromPath(path),
          placement: "nav",
          cta_variant: "nav_pricing_button",
        });
        openSurvey({ placement: "nav", ctaVariant: "nav_pricing_button" });
      }}
    >
      Get early access
    </Button>
  );
}
