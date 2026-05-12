"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { MainAppFeatures } from "@/components/main-app-features";
import { ChromeExtensionDemo } from "@/components/chrome-extension-demo";
import { ChromeExtensionFeatures } from "@/components/chrome-extension-features";
import { CompareTable } from "@/components/compare-table";
import { Pricing } from "@/components/pricing";
import { FAQSection } from "@/components/faq-section";
import { Footer } from "@/components/footer";
import { homeFAQ } from "@/lib/home-faq";
import {
  defaultHomeSurveyAnswers,
  pricingCtaLabelForTier,
  recommendedTierForSurvey,
  type HomeSurveyAnswers,
} from "@/lib/home-survey";
import { trackEvent } from "@/lib/gtag";

const LS_KEY = "anidachi_home_survey_v2";

function safeParseSurvey(raw: string | null): HomeSurveyAnswers | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return null;
    // Lightweight validation: allow only known keys; anything else falls back.
    const anyV = v as Partial<HomeSurveyAnswers>;
    if (
      anyV.segment !== "Friend_group_host" &&
      anyV.segment !== "Long_distance_watch" &&
      anyV.segment !== "Community_mod"
    ) {
      return null;
    }
    return {
      segment: anyV.segment,
      priority: anyV.priority,
      discovery: anyV.discovery,
      timing: anyV.timing,
      group_size: anyV.group_size,
    };
  } catch {
    return null;
  }
}

export function HomeClient() {
  const [survey, setSurvey] = useState<HomeSurveyAnswers>(() =>
    defaultHomeSurveyAnswers()
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromLs = safeParseSurvey(window.localStorage.getItem(LS_KEY));
    if (fromLs) setSurvey(fromLs);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_KEY, JSON.stringify(survey));
  }, [survey]);

  const recommendedTier = useMemo(
    () => recommendedTierForSurvey(survey),
    [survey]
  );

  const onSurveyAnswered = useCallback(
    (payload: { question_id: string; answer_id: string }) => {
      trackEvent("survey_answered", {
        page_path: "/",
        page_template: "home",
        ...payload,
      });
    },
    []
  );

  return (
    <main
      id="main-content"
      className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50"
    >
      <Hero
        survey={survey}
        setSurvey={setSurvey}
        onSurveyAnswered={onSurveyAnswered}
        recommendedTier={recommendedTier}
      />
      <ChromeExtensionDemo />
      <HowItWorks />
      <MainAppFeatures />
      <ChromeExtensionFeatures />
      <CompareTable />
      <Pricing
        survey={survey}
        recommendedTier={recommendedTier}
        getCtaLabelForTier={(tier) => pricingCtaLabelForTier({ tier, survey })}
      />
      <FAQSection questions={homeFAQ} defaultOpenIndexes={[2, 3, 7]} />
      <Footer />
    </main>
  );
}

