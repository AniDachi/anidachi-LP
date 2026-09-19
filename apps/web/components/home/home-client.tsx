"use client";

import { useRef } from "react";
import { Pricing } from "@/components/pricing";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { MainAppFeatures } from "@/components/main-app-features";
import { ChromeExtensionDemo } from "@/components/chrome-extension-demo";
import { CompareTable } from "@/components/compare-table";
import { SocialProof } from "@/components/social-proof";
import { FAQSection } from "@/components/faq-section";
import { homeFAQ } from "@/lib/home-faq";
import { useHomeScrollAssist } from "@/lib/use-home-scroll-assist";
import styles from "./home-sections.module.css";

export function HomeClient() {
  const pageRef = useRef<HTMLElement>(null);
  useHomeScrollAssist(pageRef);
  return (
    <main ref={pageRef} id="main-content" className={`${styles.page} min-h-screen bg-ani-canvas`}>
      <Hero />
      <ChromeExtensionDemo />
      <HowItWorks />
      <CompareTable />
      <MainAppFeatures />
      <Pricing />
      <SocialProof />
      <FAQSection questions={homeFAQ} />
    </main>
  );
}
