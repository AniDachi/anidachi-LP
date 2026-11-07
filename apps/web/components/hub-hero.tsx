"use client";

import { useEffect } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstallLink } from "@/components/install-link";
import { WatchingTogetherCount } from "@/components/watching-together-count";
import { inferPageTemplateFromPath, trackConversion } from "@/lib/conversion-events";
import { INSTALL_CTA_LABEL, INSTALL_HUB_PATH } from "@/lib/install-cta";

/**
 * The homepage hero's install pattern for platform hubs (ANI-28): one primary button right under
 * the H1, a "see it" link to the demo, and the joined count. Replaces the hub's above-the-fold
 * install card, so a hub still shows at most two install CTAs (this and the bottom card).
 */
export function HubHero({
  pagePath,
  lead,
  finePrint,
}: {
  pagePath: string;
  lead: string;
  finePrint: string;
}) {
  const pageTemplate = inferPageTemplateFromPath(pagePath);

  useEffect(() => {
    trackConversion("cta_impression", {
      page_path: pagePath,
      page_template: pageTemplate,
      placement: "hub_hero",
      cta_variant: "hub_hero_install",
    });
  }, [pagePath, pageTemplate]);

  return (
    <div className="not-prose mb-10">
      <p className="mb-6 max-w-2xl text-pretty text-lg leading-relaxed text-ani-text md:text-xl">
        {lead}
      </p>
      <div className="mb-4 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
        <Button variant="cream" size="control" className="px-8 text-sm sm:w-auto" asChild>
          <InstallLink
            href={INSTALL_HUB_PATH}
            onClick={() => {
              trackConversion("cta_click", {
                page_path: pagePath,
                page_template: pageTemplate,
                placement: "hub_hero",
                cta_variant: "hub_hero_install",
              });
            }}
          >
            {INSTALL_CTA_LABEL}
          </InstallLink>
        </Button>
        <Button asChild variant="creamOutline" size="control" className="px-8 text-sm sm:w-auto">
          <a href="#demo">
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
            See It in Action
          </a>
        </Button>
      </div>
      <p className="max-w-2xl text-sm leading-relaxed text-ani-muted">{finePrint}</p>
      <WatchingTogetherCount className="mt-2" />
      <p className="mt-2 max-w-md text-sm text-ani-muted md:hidden">
        Watch parties run in desktop Chrome. Open the install page on your computer, or copy the
        link to open it there.
      </p>
    </div>
  );
}
