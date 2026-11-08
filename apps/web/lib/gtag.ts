export const GA_MEASUREMENT_ID = "G-W9HZVZ9S0P";

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

export function trackEvent(
  action: string,
  params?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  if (typeof window.gtag === "function") {
    window.gtag("event", action, params);
  }
  // Core Web Vitals stay in GA4 only: high volume, no funnel value in Amplitude.
  if (action === "web_vital") return;
  void import("@/lib/amplitude").then((m) =>
    m.trackAmplitudeEvent(action, params).catch(() => {})
  );
}
