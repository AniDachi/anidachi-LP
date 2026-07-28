/**
 * Field Core Web Vitals reporting (LCP, INP, CLS) via PerformanceObserver.
 * Sends GA4/Amplitude events only — no UI, no blocking of core flows.
 */
import { trackEvent } from "@/lib/gtag";
import { inferPageTemplateFromPath } from "@/lib/conversion-events";

type MetricName = "LCP" | "INP" | "CLS";

function reportMetric(name: MetricName, value: number, rating: string) {
  if (typeof window === "undefined") return;
  const pagePath = window.location.pathname || "/";
  trackEvent("web_vital", {
    metric_name: name,
    // GA4 custom metrics often expect integers; send ms for LCP/INP, 1000*CLS.
    value: name === "CLS" ? Math.round(value * 1000) : Math.round(value),
    metric_value: value,
    metric_rating: rating,
    page_path: pagePath,
    page_template: inferPageTemplateFromPath(pagePath),
  });
}

function rateLcp(ms: number): string {
  if (ms <= 2500) return "good";
  if (ms <= 4000) return "needs-improvement";
  return "poor";
}

function rateInp(ms: number): string {
  if (ms <= 200) return "good";
  if (ms <= 500) return "needs-improvement";
  return "poor";
}

function rateCls(score: number): string {
  if (score <= 0.1) return "good";
  if (score <= 0.25) return "needs-improvement";
  return "poor";
}

export function initWebVitalsReporting(): () => void {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
    return () => {};
  }

  const cleanups: Array<() => void> = [];

  try {
    let lcpValue = 0;
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) lcpValue = last.startTime;
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    const flushLcp = () => {
      if (lcpValue > 0) reportMetric("LCP", lcpValue, rateLcp(lcpValue));
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushLcp();
    });
    window.addEventListener("pagehide", flushLcp);
    cleanups.push(() => {
      lcpObserver.disconnect();
      window.removeEventListener("pagehide", flushLcp);
    });
  } catch {
    // Unsupported browser — skip
  }

  try {
    let inpValue = 0;
    const inpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // PerformanceEventTiming
        const e = entry as PerformanceEventTiming;
        if (e.interactionId && e.duration > inpValue) {
          inpValue = e.duration;
        }
      }
    });
    inpObserver.observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
    const flushInp = () => {
      if (inpValue > 0) reportMetric("INP", inpValue, rateInp(inpValue));
    };
    window.addEventListener("pagehide", flushInp);
    cleanups.push(() => {
      inpObserver.disconnect();
      window.removeEventListener("pagehide", flushInp);
    });
  } catch {
    // event timing unsupported
  }

  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as LayoutShift;
        if (!e.hadRecentInput) clsValue += e.value;
      }
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });
    const flushCls = () => {
      // Skip empty sessions so we do not spam zero-CLS events.
      if (clsValue > 0) reportMetric("CLS", clsValue, rateCls(clsValue));
    };
    window.addEventListener("pagehide", flushCls);
    cleanups.push(() => {
      clsObserver.disconnect();
      window.removeEventListener("pagehide", flushCls);
    });
  } catch {
    // layout-shift unsupported
  }

  return () => {
    for (const fn of cleanups) fn();
  };
}

/** Minimal typings for observers not in all TS DOM libs. */
interface PerformanceEventTiming extends PerformanceEntry {
  duration: number;
  interactionId?: number;
}

interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}
