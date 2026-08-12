"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown, Rocket } from "lucide-react";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { JoinDiscordButton } from "@/components/join-discord-button";
import { trackEvent } from "@/lib/gtag";
import { trackConversion } from "@/lib/conversion-events";
import { PRICING_CTA_LABEL } from "@/lib/home-survey";
import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";

function WaitlistLine({ count }: { count: number | null }) {
  if (count === null) {
    return <>Launching soon — join the waitlist</>;
  }
  if (count === 0) {
    return <>Launching soon — be first on the waitlist</>;
  }
  return (
    <>
      Launching soon —{" "}
      <span className="font-medium text-brand-orange-bright">
        {count.toLocaleString()}
      </span>{" "}
      on the waitlist
    </>
  );
}

export function Hero({ waitlistCount: initialWaitlistCount }: { waitlistCount: number | null }) {
  const { openSurvey, recommendedTier, survey } = usePlanSurvey();
  const [waitlistCount, setWaitlistCount] = useState<number | null>(initialWaitlistCount);

  useEffect(() => {
    trackConversion("cta_impression", {
      page_path: "/",
      page_template: "home",
      placement: "hero",
      cta_variant: "hero_waitlist_early_access",
    });
  }, []);

  useEffect(() => {
    setWaitlistCount(initialWaitlistCount);
  }, [initialWaitlistCount]);

  useEffect(() => {
    if (initialWaitlistCount !== null) return;
    let cancelled = false;
    fetch("/api/waitlist-stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { count?: number | null } | null) => {
        if (cancelled || !data || typeof data.count !== "number") return;
        setWaitlistCount(data.count);
      })
      .catch(() => {
        // Keep fallback copy if the count cannot be loaded.
      });
    return () => {
      cancelled = true;
    };
  }, [initialWaitlistCount]);

  return (
    <section className="relative overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 motion-reduce:hidden" aria-hidden>
        <div className="absolute left-1/2 top-[-10%] h-[min(70vw,520px)] w-[min(110vw,820px)] -translate-x-1/2 rounded-full bg-brand-orange/[0.09] blur-[100px]" />
      </div>

      <div className="relative container mx-auto px-4 pb-10 pt-14 md:pb-12 md:pt-20 lg:pt-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-7 flex items-center gap-3 md:mb-8">
            <AnidachiLogo size={56} priority />
            <p className="text-2xl font-bold tracking-[-0.04em] text-foreground md:text-3xl">
              AniDachi
            </p>
          </div>

          <h1 className="mb-5 max-w-[18ch] text-balance text-4xl font-bold tracking-[-0.035em] text-foreground md:mb-6 md:max-w-none md:text-6xl md:leading-[1.05] lg:text-7xl">
            Your friends are watching without you.{" "}
            <span className="text-brand-orange">Fix that.</span>
          </h1>

          <p className="mb-8 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70 md:text-xl">
            Watch together on Crunchyroll and YouTube — synced, in chat, across
            time zones.
          </p>

          <div className="mb-5 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Button
              size="touch"
              className="bg-brand-orange px-8 text-base font-semibold text-primary-foreground transition-[transform,background-color,box-shadow] duration-200 ease-out hover:bg-brand-orange-deep active:scale-[0.98] sm:w-auto"
              onClick={() => {
                trackConversion("cta_click", {
                  page_path: "/",
                  page_template: "home",
                  placement: "hero",
                  cta_variant: "hero_waitlist_early_access",
                  recommended_tier: recommendedTier,
                  segment: survey.segment,
                  priority: survey.priority ?? "unset",
                });
                openSurvey({
                  placement: "hero",
                  ctaVariant: "hero_waitlist_early_access",
                });
              }}
            >
              <Rocket className="h-5 w-5" aria-hidden="true" />
              {PRICING_CTA_LABEL}
            </Button>
            <Button
              asChild
              size="touch"
              variant="ghost"
              className="border border-brand-border bg-transparent px-8 text-base font-semibold text-foreground/75 transition-[transform,background-color,color] duration-200 ease-out hover:bg-brand-surface hover:text-foreground active:scale-[0.98] sm:w-auto"
            >
              <a
                href="#how-it-works"
                onClick={() =>
                  trackEvent("extension_clicked", { cta: "hero_extension" })
                }
              >
                <ArrowDown className="h-5 w-5" aria-hidden="true" />
                See How It Works
              </a>
            </Button>
          </div>

          <p className="mb-3 text-sm text-foreground/45">
            <WaitlistLine count={waitlistCount} />
          </p>

          <p className="mb-4 max-w-md text-sm text-foreground/40 md:hidden">
            Watch parties run in desktop Chrome — manage invites and your account
            here on mobile.
          </p>

          <JoinDiscordButton
            variant="hero"
            placement="hero"
            className="mt-1 h-auto min-h-0 border-0 bg-transparent px-0 py-2 text-sm font-medium text-foreground/50 shadow-none hover:bg-transparent hover:text-brand-orange-bright"
          />
        </div>
      </div>
    </section>
  );
}
