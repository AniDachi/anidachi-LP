"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown, MessageCircle, Play, Rocket, Users } from "lucide-react";
import { trackEvent } from "@/lib/gtag";
import { trackConversion } from "@/lib/conversion-events";
import { PRICING_CTA_LABEL } from "@/lib/home-survey";
import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";

function WaitlistPillContent({ count }: { count: number | null }) {
  if (count === null) {
    return <>Launching soon · join the waitlist</>;
  }
  if (count === 0) {
    return <>Launching soon · be first on the waitlist</>;
  }
  return (
    <>
      Launching soon ·{" "}
      <span className="font-semibold text-brand-orange">
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
      {/* Radial orange glow — subtle accent */}
      <div className="pointer-events-none absolute inset-0 motion-reduce:hidden">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[700px] rounded-full bg-brand-orange/8 blur-[120px]" />
        <div className="absolute right-16 top-32 h-24 w-24 rounded-full bg-brand-orange/10 blur-2xl motion-reduce:animate-none" />
      </div>

      {/* Subtle grain texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025] noise-overlay mix-blend-overlay"
        aria-hidden
      />

      {/* Subtle grid overlay for the futuristic feel */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.95 0.008 60) 1px, transparent 1px), linear-gradient(90deg, oklch(0.95 0.008 60) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative container mx-auto px-4 py-16 lg:py-20">
        <div className="mx-auto max-w-4xl text-center">
          {/* Pre-launch status pill */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-surface px-4 py-2 text-sm font-medium text-foreground/80 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-orange opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-orange" />
            </span>
            <WaitlistPillContent count={waitlistCount} />
          </div>

          <h1 className="mb-4 text-4xl font-bold text-foreground md:text-6xl lg:text-7xl">
            Your friends are watching without you.{" "}
            <span className="text-brand-orange">Fix that.</span>
          </h1>
          <p className="mx-auto mb-6 max-w-2xl text-lg text-foreground/70 md:text-xl">
            Watch anime with friends on Crunchyroll — synced, in chat, across
            time zones.
          </p>

          <div className="mb-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="w-full bg-brand-orange px-8 text-base font-semibold text-primary-foreground glow-orange transition-all duration-300 hover:bg-brand-orange-deep hover:glow-orange-lg sm:w-auto"
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
              size="lg"
              variant="ghost"
              className="w-full border border-brand-border bg-transparent px-8 text-base font-semibold text-foreground/70 transition-all duration-300 hover:bg-brand-orange hover:text-primary-foreground sm:w-auto"
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

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-foreground/50">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 text-brand-orange/70" aria-hidden="true" />
              Crunchyroll
            </span>
            <span className="text-brand-border/80" aria-hidden="true">
              ·
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4 text-brand-orange/70" aria-hidden="true" />
              Real-time chat
            </span>
            <span className="text-brand-border/80" aria-hidden="true">
              ·
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Play className="h-4 w-4 text-brand-orange/70" aria-hidden="true" />
              Perfect sync
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
