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

let amplitudeSyncId = 0;

async function syncAmplitudeUserFromSession(signal: AbortSignal): Promise<void> {
  const syncId = ++amplitudeSyncId;
  const stillCurrent = () => syncId === amplitudeSyncId && !signal.aborted;
  try {
    // Analytics observes the current account. Only the site's auth flow may
    // refresh or clear website credentials; never retry a 401 through refresh.
    const response = await fetch("/api/me", { signal, cache: "no-store" });
    if (!stillCurrent()) return;
    if (response.status === 401) {
      await resetAmplitudeUser(stillCurrent);
      return;
    }
    // Temporary failures are not evidence of sign-out.
    if (!response.ok) return;
    const data = (await response.json().catch(() => null)) as MeResponse | null;
    if (!stillCurrent()) return;
    const user = data?.user;
    if (typeof user?.id !== "string" || !user.id.trim()) return;
    await identifyAmplitudeUser(
      {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        plan: user.plan,
      },
      stillCurrent,
    );
  } catch {
    // Analytics must not break the page. Navigation aborts this request.
  }
}

export function AnalyticsEvents() {
  const pathname = usePathname();

  // Re-attempt first-touch capture on client navigations (e.g. /login → guide).
  // Idempotent once a marketing path is stored for the session.
  useEffect(() => {
    captureFirstLandingPath();
    const controller = new AbortController();
    void syncAmplitudeUserFromSession(controller.signal);
    // A bare abort() becomes "signal is aborted without reason", which the
    // Next.js dev overlay reports as a crash. A string reason stays a cancel.
    return () => controller.abort("analytics-cancelled");
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
