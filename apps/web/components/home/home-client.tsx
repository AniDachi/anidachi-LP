"use client";

import { Pricing } from "@/components/pricing";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { MainAppFeatures } from "@/components/main-app-features";
import { ChromeExtensionDemo } from "@/components/chrome-extension-demo";
import { ChromeExtensionFeatures } from "@/components/chrome-extension-features";
import { CompareTable } from "@/components/compare-table";
import { FAQSection } from "@/components/faq-section";
import { homeFAQ } from "@/lib/home-faq";
import { pricingCtaLabelForTier } from "@/lib/home-survey";
import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";

export function HomeClient({ waitlistCount }: { waitlistCount: number | null }) {
  const { survey, recommendedTier } = usePlanSurvey();

  return (
    <main
      id="main-content"
      className="min-h-screen bg-background"
    >
      <Hero waitlistCount={waitlistCount} />
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
    </main>
  );
}

