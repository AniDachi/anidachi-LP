"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { JoinDiscordButton } from "@/components/join-discord-button";
import { trackEvent } from "@/lib/gtag";
import { trackConversion } from "@/lib/conversion-events";
import {
  DE_INSTALL_CTA_LABEL,
  DE_INSTALL_HUB_PATH,
  INSTALL_CTA_LABEL,
  INSTALL_HUB_PATH,
} from "@/lib/install-cta";
import { UI_STRINGS, type PageLocale } from "@/lib/locale/ui-strings";
import { WatchingTogetherCount } from "@/components/watching-together-count";
import { InstallLink } from "@/components/install-link";

const COPY = {
  en: {
    h1: "Your friends are watching without you.",
    h1Accent: "Fix that.",
    lead: "Watch together on Crunchyroll, YouTube, and Netflix — synced, in chat, across time zones.",
    howItWorks: "See How It Works",
  },
  de: {
    h1: "Deine Freunde schauen ohne dich.",
    h1Accent: "Starte eine Watchparty.",
    lead: "Watch Together für Netflix, YouTube und Crunchyroll: synchron, mit Chat, über Zeitzonen hinweg.",
    howItWorks: "So funktioniert es",
  },
} as const;

export function Hero({ locale = "en" }: { locale?: PageLocale } = {}) {
  const copy = COPY[locale];
  const de = locale === "de";
  const pagePath = de ? "/de" : "/";
  const pageTemplate = de ? "de_pilot" : "home";
  useEffect(() => {
    trackConversion("cta_impression", {
      page_path: pagePath,
      page_template: pageTemplate,
      placement: "hero",
      cta_variant: "hero_install",
    });
  }, [pagePath, pageTemplate]);
  return (
    <section className="relative overflow-hidden bg-ani-canvas text-ani-text">
      <div className="relative container mx-auto px-4 pb-10 pt-14 md:pb-12 md:pt-20 lg:pt-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-7 flex items-center gap-3 md:mb-8">
            <AnidachiLogo size={56} priority />
            <p className="text-2xl font-semibold tracking-[-0.04em] text-ani-text md:text-3xl">
              AniDachi
            </p>
          </div>

          <h1 className="mb-5 max-w-[18ch] text-balance text-4xl font-semibold tracking-[-0.035em] text-ani-text md:mb-6 md:max-w-none md:text-6xl md:leading-[1.05] lg:text-7xl">
            {copy.h1}{" "}
            <span className="text-ani-progress">{copy.h1Accent}</span>
          </h1>

          <p className="mb-8 max-w-xl text-pretty text-lg leading-relaxed text-ani-muted md:text-xl">
            {copy.lead}
          </p>

          <div className="mb-5 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Button
              variant="cream"
              size="control"
              className="px-8 text-sm sm:w-auto"
              asChild
            >
              <InstallLink
                href={de ? DE_INSTALL_HUB_PATH : INSTALL_HUB_PATH}
                storePlacement="hero"
                onClick={() => {
                  trackConversion("cta_click", {
                    page_path: pagePath,
                    page_template: pageTemplate,
                    placement: "hero",
                    cta_variant: "hero_install",
                  });
                }}
              >
                {de ? DE_INSTALL_CTA_LABEL : INSTALL_CTA_LABEL}
              </InstallLink>
            </Button>
            <Button
              asChild
              variant="creamOutline"
              size="control"
              className="px-8 text-sm sm:w-auto"
            >
              <a
                href="#how-it-works"
                onClick={() =>
                  trackEvent("extension_clicked", { cta: "hero_extension" })
                }
              >
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
                {copy.howItWorks}
              </a>
            </Button>
          </div>

          <WatchingTogetherCount className="mb-3" locale={locale} />
          <p className="mb-4 max-w-md text-sm text-ani-muted md:hidden">
            {de
              ? UI_STRINGS.de.mobileInstallNote
              : "Watch parties run in desktop Chrome — open the install page on your computer, or copy the link to open it there."}
          </p>

          <JoinDiscordButton
            variant="hero"
            placement="hero"
            label={de ? "Zur Discord-Community" : undefined}
            className="mt-1 h-auto min-h-0 border-0 bg-transparent px-0 py-2 text-sm font-medium text-ani-muted shadow-none hover:bg-transparent hover:text-ani-progress"
          />
        </div>
      </div>
    </section>
  );
}
