"use client";

import { Pricing } from "@/components/pricing";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { MainAppFeatures } from "@/components/main-app-features";
import { ChromeExtensionDemo } from "@/components/chrome-extension-demo";
import { CompareTable } from "@/components/compare-table";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
import { SocialProof } from "@/components/social-proof";
import { FAQSection } from "@/components/faq-section";
import { homeFAQ } from "@/lib/home-faq";
import { pricingCtaLabelForTier } from "@/lib/home-survey";
import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";

export function HomeClient({ waitlistCount }: { waitlistCount: number | null }) {
  const { survey, recommendedTier } = usePlanSurvey();

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <Hero waitlistCount={waitlistCount} />
      <ChromeExtensionDemo />
      <HowItWorks />
      <CompareTable />
      <MainAppFeatures />
      <div className="container mx-auto mb-8 px-4">
        <PrimaryCheckoutCta
          pagePath="/"
          pageTemplate="home"
          placement="content_mid"
          ctaVariant="home_pre_pricing"
        />
      </div>
      <Pricing
        survey={survey}
        recommendedTier={recommendedTier}
        getCtaLabelForTier={(tier) => pricingCtaLabelForTier({ tier, survey })}
      />
      <SocialProof />
      <FAQSection questions={homeFAQ} defaultOpenIndexes={[4]} />
    </main>
  );
}
