"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initAmplitudeClient } from "@/lib/amplitude";
import { trackEvent } from "@/lib/gtag";
import { captureFirstLandingPath } from "@/lib/seo-landing-path";
import { initWebVitalsReporting } from "@/lib/web-vitals-report";

export function AnalyticsEvents() {
  const pathname = usePathname();

  // Re-attempt first-touch capture on client navigations (e.g. /login → guide).
  // Idempotent once a marketing path is stored for the session.
  useEffect(() => {
    captureFirstLandingPath();
  }, [pathname]);

  useEffect(() => {
    initAmplitudeClient();
    const stopVitals = initWebVitalsReporting();

    let fired50 = false;
    let fired90 = false;

    function onScroll() {
      const scrollPercent =
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) *
        100;

      if (!fired50 && scrollPercent >= 50) {
        fired50 = true;
        trackEvent("scroll_50");
      }
      if (!fired90 && scrollPercent >= 90) {
        fired90 = true;
        trackEvent("scroll_90");
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      stopVitals();
    };
  }, []);

  return null;
}
