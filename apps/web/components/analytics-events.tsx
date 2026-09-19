"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  identifyAmplitudeUser,
  initAmplitudeClient,
  resetAmplitudeUser,
} from "@/lib/amplitude";
import { trackEvent } from "@/lib/gtag";
import { captureFirstLandingPath } from "@/lib/seo-landing-path";
import { initWebVitalsReporting } from "@/lib/web-vitals-report";

type MeResponse = {
  user?: {
    id?: string;
    email?: string;
    displayName?: string;
    plan?: string;
  };
};

async function syncAmplitudeUserFromSession(): Promise<void> {
  try {
    let response = await fetch("/api/me");
    if (response.status === 401) {
      const refreshResponse = await fetch("/api/auth/refresh", { method: "POST" });
      if (refreshResponse.ok) response = await fetch("/api/me");
    }
    if (!response.ok) {
      await resetAmplitudeUser();
      return;
    }
    const data = (await response.json().catch(() => null)) as MeResponse | null;
    const user = data?.user;
    if (!user?.id) {
      await resetAmplitudeUser();
      return;
    }
    await identifyAmplitudeUser({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      plan: user.plan,
    });
  } catch {
    // Analytics must not break the page.
  }
}

export function AnalyticsEvents() {
  const pathname = usePathname();

  // Re-attempt first-touch capture on client navigations (e.g. /login → guide).
  // Idempotent once a marketing path is stored for the session.
  useEffect(() => {
    captureFirstLandingPath();
    void syncAmplitudeUserFromSession();
  }, [pathname]);

  useEffect(() => {
    initAmplitudeClient();
    void syncAmplitudeUserFromSession();
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
