import { trackEvent } from "@/lib/gtag";

/**
 * Funnel event taxonomy (GA4) — see docs/CONVERSION_METRICS.md
 */
export type ConversionFunnelEvent =
  | "cta_impression"
  | "cta_click"
  | "checkout_session_started"
  | "checkout_redirect_success"
  | "checkout_error";

export type PageTemplateId =
  | "home"
  | "default"
  | "guide"
  | "compare"
  | "anime"
  | "listicle"
  | "glossary"
  | "pillar";

export function getExperimentVariant(): string {
  if (typeof process === "undefined") return "control";
  return process.env.NEXT_PUBLIC_CTA_EXPERIMENT_VARIANT ?? "control";
}

/**
 * Derive a template id from the canonical path (no trailing slash) for analytics.
 */
export function inferPageTemplateFromPath(path: string): PageTemplateId {
  if (path === "/") return "home";
  if (path.startsWith("/watch/") && path.includes("-with-friends")) {
    return "anime";
  }
  if (path.startsWith("/guides/best-anime-to-watch-")) {
    return "listicle";
  }
  if (path.startsWith("/guides/")) {
    return "guide";
  }
  if (path.startsWith("/compare/")) {
    return "compare";
  }
  if (path.startsWith("/glossary/")) {
    return "glossary";
  }
  if (
    path === "/watch-anime-together" ||
    path === "/watch-crunchyroll-together" ||
    path === "/anime-watch-party-toolkit"
  ) {
    return "pillar";
  }
  return "default";
}

export function ctaCopyVariantForTemplate(
  template: PageTemplateId
): "default" | "guide" | "compare" | "anime" | "listicle" | "glossary" | "pillar" {
  if (template === "anime") return "anime";
  if (template === "listicle") return "listicle";
  if (template === "guide") return "guide";
  if (template === "compare") return "compare";
  if (template === "glossary") return "glossary";
  if (template === "pillar") return "pillar";
  return "default";
}

/**
 * Fire conversion-related GA4 events with consistent page context.
 */
export function trackConversion(
  name: ConversionFunnelEvent,
  params: {
    page_path: string;
    page_template: PageTemplateId;
    placement: string;
    cta_variant?: string;
  } & Record<string, unknown>
) {
  const payload = {
    ...params,
    cta_experiment: getExperimentVariant(),
  };
  trackEvent(name, payload);
}
