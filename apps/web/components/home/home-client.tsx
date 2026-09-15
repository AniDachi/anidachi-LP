"use client";

import { Pricing } from "@/components/pricing";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { MainAppFeatures } from "@/components/main-app-features";
import { ChromeExtensionDemo } from "@/components/chrome-extension-demo";
import { CompareTable } from "@/components/compare-table";
import { SocialProof } from "@/components/social-proof";
import { FAQSection } from "@/components/faq-section";
import { homeFAQ } from "@/lib/home-faq";

export function HomeClient() {
  return (
    <main id="main-content" className="min-h-screen bg-ani-canvas">
      <Hero />
      <ChromeExtensionDemo />
      <HowItWorks />
      <CompareTable />
      <MainAppFeatures />
      <Pricing />
      <SocialProof />
      <FAQSection questions={homeFAQ} defaultOpenIndexes={[0]} />
    </main>
  );
}
