"use client";

import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";
import { PRICING_CTA_LABEL } from "@/lib/home-survey";
import {
  inferPageTemplateFromPath,
  trackConversion,
} from "@/lib/conversion-events";

export function PricingSurveyLink() {
  const { openSurvey } = usePlanSurvey();
  return (
    <button
      type="button"
      className="text-sm text-brand-orange underline underline-offset-2 hover:text-brand-orange-bright min-h-11 inline-flex items-center"
      onClick={() => {
        const path =
          typeof window !== "undefined" ? window.location.pathname : "/";
        trackConversion("cta_click", {
          page_path: path,
          page_template: inferPageTemplateFromPath(path),
          placement: "pricing_section",
          cta_variant: "pricing_survey_help",
        });
        openSurvey({
          placement: "pricing_section",
          ctaVariant: "pricing_survey_help",
        });
      }}
    >
      Not sure yet? {PRICING_CTA_LABEL}
    </button>
  );
}
