"use client";

import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";
import {
  inferPageTemplateFromPath,
  trackConversion,
} from "@/lib/conversion-events";

export function PricingSurveyLink() {
  const { openSurvey } = usePlanSurvey();
  return (
    <button
      type="button"
      className="text-sm text-purple-600 underline underline-offset-2 hover:text-purple-800 min-h-11 inline-flex items-center"
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
      Not sure yet? Get early access and lock in your price
    </button>
  );
}
