"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/gtag";

export function AnalyticsEvents() {
  useEffect(() => {
    void import("@/lib/amplitude").then((m) => m.initAmplitudeClient());

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
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
