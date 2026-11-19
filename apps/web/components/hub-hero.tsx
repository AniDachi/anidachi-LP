"use client";

import { useEffect } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstallLink } from "@/components/install-link";
import { WatchingTogetherCount } from "@/components/watching-together-count";
import { StoreRatingLine } from "@/components/store-rating-line";
import { inferPageTemplateFromPath, trackConversion } from "@/lib/conversion-events";
import { INSTALL_CTA_LABEL, INSTALL_HUB_PATH } from "@/lib/install-cta";
import { DE_PLATFORM_HUBS, UI_STRINGS, type PageLocale } from "@/lib/locale/ui-strings";
import { cn } from "@/lib/utils";
import Link from "next/link";

/** Platform hubs the "Works on" line links to (the current page is left as plain text). */
const PLATFORM_HUBS: Record<string, string> = {
  Crunchyroll: "/watch-crunchyroll-together",
  YouTube: "/watch-youtube-together",
  Netflix: "/netflix-watch-party",
};

/**
 * The homepage hero's install pattern for platform hubs (ANI-28): one primary button right under
 * the H1, a "see it" link to the demo, and the store rating (the joined count on German pages). Replaces the hub's above-the-fold
 * install card, so a hub still shows at most two install CTAs (this and the bottom card).
 * Guides reuse it after the short answer (ANI-64) with their own `placement` and no demo link.
 */
export function HubHero({
  pagePath,
  lead,
  finePrint,
  demoHref = "#demo",
  align = "left",
  ctaLabel = INSTALL_CTA_LABEL,
  ctaHref = INSTALL_HUB_PATH,
  worksOn,
  worksOnLabel,
  locale = "en",
  placement = "hub_hero",
  ctaVariant = "hub_hero_install",
  className,
}: {
  pagePath: string;
  lead: string;
  finePrint: string;
  /** Anchor for the "See it in action" button; pass null on pages without a demo. */
  demoHref?: string | null;
  align?: "left" | "center";
  /** Platform-specific button text, e.g. "Start a Crunchyroll Watch Party". */
  ctaLabel?: string;
  /** Supported platforms, this page's first, shown under the buttons. */
  worksOn?: string[];
  /** Lead-in for the platforms line, e.g. "Works with". */
  worksOnLabel?: string;
  /** Button destination; German pages go straight to the store listing. */
  ctaHref?: string;
  /** Page language for the fixed labels and the platform links. */
  locale?: PageLocale;
  /** Analytics placement for impressions, clicks and store clicks. */
  placement?: string;
  ctaVariant?: string;
  className?: string;
}) {
  const centered = align === "center";
  const de = locale === "de";
  const t = UI_STRINGS[locale];
  const hubs = locale === "de" ? DE_PLATFORM_HUBS : PLATFORM_HUBS;
  const pageTemplate = inferPageTemplateFromPath(pagePath);

  useEffect(() => {
    trackConversion("cta_impression", {
      page_path: pagePath,
      page_template: pageTemplate,
      placement,
      cta_variant: ctaVariant,
    });
  }, [pagePath, pageTemplate, placement, ctaVariant]);

  return (
    <div className={cn("not-prose mb-10", centered && "mx-auto flex max-w-3xl flex-col items-center text-center", className)}>
      <p
        className={cn(
          "mb-6 text-pretty text-lg leading-relaxed md:text-xl",
          centered ? "max-w-xl" : "max-w-2xl",
          centered ? "text-ani-muted" : "text-ani-text",
        )}
      >
        {lead}
      </p>
      <div
        className={cn(
          "mb-5 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center",
          centered && "sm:justify-center",
        )}
      >
        <Button variant="cream" size="control" className="px-8 text-sm sm:w-auto" asChild>
          <InstallLink
            href={ctaHref}
            storePlacement={placement}
            onClick={() => {
              trackConversion("cta_click", {
                page_path: pagePath,
                page_template: pageTemplate,
                placement,
                cta_variant: ctaVariant,
              });
            }}
          >
            {ctaLabel}
          </InstallLink>
        </Button>
        {demoHref ? (
          <Button asChild variant="creamOutline" size="control" className="px-8 text-sm sm:w-auto">
            <a href={demoHref}>
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
              {t.seeItInAction}
            </a>
          </Button>
        ) : null}
      </div>
      {!de ? <StoreRatingLine className={cn("mb-3", !centered && "justify-start")} /> : null}
      {worksOn && worksOn.length > 0 ? (
        <p className="mb-2 text-sm text-ani-text">
          {worksOnLabel ?? t.worksOn}{" "}
          {worksOn.map((platform, i) => {
            const href = hubs[platform];
            return (
              <span key={platform}>
                {i > 0 ? " · " : null}
                {href && href !== pagePath ? (
                  <Link href={href} className="underline decoration-ani-line underline-offset-4 hover:decoration-ani-text">
                    {platform}
                  </Link>
                ) : (
                  platform
                )}
              </span>
            );
          })}
        </p>
      ) : null}
      {centered ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-ani-muted">
          <span>{finePrint}</span>
          {de ? (
            <WatchingTogetherCount locale={locale} className="!m-0 !leading-5 sm:before:mr-3 sm:before:text-ani-muted sm:before:content-['·']" />
          ) : null}
        </div>
      ) : (
        <>
          <p className="max-w-2xl text-sm leading-relaxed text-ani-muted">{finePrint}</p>
          {de ? <WatchingTogetherCount locale={locale} className="!mb-0 mt-2" /> : null}
        </>
      )}
      <p className="mt-2 max-w-md text-sm text-ani-muted md:hidden">
        {t.mobileInstallNote}
      </p>
    </div>
  );
}
