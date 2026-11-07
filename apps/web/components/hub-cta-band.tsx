"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { InstallLink } from "@/components/install-link";
import { inferPageTemplateFromPath, trackConversion } from "@/lib/conversion-events";
import { INSTALL_CTA_LABEL, INSTALL_HUB_PATH } from "@/lib/install-cta";

/**
 * Centered mid-page install band for hub pages, styled like the homepage's section CTAs. It is the
 * hub's second (and last) install CTA, so it replaces the boxed bottom card.
 */
export function HubCtaBand({
  pagePath,
  heading,
  body,
  placement = "content_after_compare",
  ctaLabel = INSTALL_CTA_LABEL,
}: {
  pagePath: string;
  heading: string;
  body: string;
  placement?: string;
  /** Same platform-specific text as the hero button. */
  ctaLabel?: string;
}) {
  const pageTemplate = inferPageTemplateFromPath(pagePath);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const fire = () =>
      trackConversion("cta_impression", {
        page_path: pagePath,
        page_template: pageTemplate,
        placement,
        cta_variant: "hub_band_install",
      });
    if (typeof IntersectionObserver === "undefined") {
      fire();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          fire();
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pagePath, pageTemplate, placement]);

  return (
    <div
      ref={rootRef}
      className="not-prose my-20 border-y border-ani-line px-4 py-14 text-center"
    >
      <p className="mx-auto max-w-xl mb-0 text-balance text-3xl font-semibold leading-[1.1] tracking-[-0.03em] text-ani-text md:text-4xl">
        {heading}
      </p>
      <p className="mx-auto mt-4 max-w-md text-pretty text-ani-muted">{body}</p>
      <Button variant="cream" size="control" className="mt-8 px-8 text-sm" asChild>
        <InstallLink
          href={INSTALL_HUB_PATH}
          onClick={() => {
            trackConversion("cta_click", {
              page_path: pagePath,
              page_template: pageTemplate,
              placement,
              cta_variant: "hub_band_install",
            });
          }}
        >
          {ctaLabel}
        </InstallLink>
      </Button>
    </div>
  );
}
