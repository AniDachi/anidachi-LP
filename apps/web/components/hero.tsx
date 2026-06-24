"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chrome, MessageCircle, Play, Rocket, Users } from "lucide-react";
import { trackEvent } from "@/lib/gtag";
import { trackConversion } from "@/lib/conversion-events";
import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";

function formatWaitlistPill(count: number | null): string {
  if (count === null) return "Launching soon · join the waitlist";
  if (count === 0) return "Launching soon · be the first on the waitlist";
  const label = count === 1 ? "person" : "people";
  return `Launching soon · ${count.toLocaleString()} ${label} already on the waitlist`;
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
      {/* Radial orange glow — the energy core */}
      <div className="pointer-events-none absolute inset-0 motion-reduce:hidden">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-[--brand-orange]/10 blur-[120px]" />
        <div className="absolute top-20 left-10 w-20 h-20 bg-[--brand-orange]/15 rounded-full blur-xl motion-reduce:animate-none animate-pulse" />
        <div className="absolute top-40 right-20 w-32 h-32 bg-[--brand-orange-bright]/10 rounded-full blur-xl motion-reduce:animate-none animate-pulse delay-1000" />
        <div className="absolute bottom-20 left-1/3 w-24 h-24 bg-[--brand-orange-deep]/15 rounded-full blur-xl motion-reduce:animate-none animate-pulse delay-500" />
      </div>

      {/* Subtle grid overlay for the futuristic feel */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.95 0.008 60) 1px, transparent 1px), linear-gradient(90deg, oklch(0.95 0.008 60) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative container mx-auto px-4 py-24 lg:py-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Pre-launch status pill */}
          <div className="inline-flex items-center gap-2 bg-[--brand-surface] backdrop-blur-sm border border-[--brand-border] text-foreground/80 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            {formatWaitlistPill(waitlistCount)}
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-foreground via-foreground to-[--brand-orange-bright] bg-clip-text text-transparent">
            Your friends are watching without you. Fix that.
          </h1>
          <p className="text-xl md:text-2xl mb-4 text-foreground/70 max-w-3xl mx-auto leading-relaxed">
            Sync with your crew across any timezone. Create a watchroom, share
            the link, react to every plot twist — even when you don&apos;t watch
            at the same time.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button
              size="touch"
              className="bg-[--brand-orange] text-[--primary-foreground] hover:bg-[--brand-orange-deep] w-full sm:w-auto px-8 text-lg font-semibold glow-orange hover:glow-orange-lg transition-all duration-300 md:hover:scale-105"
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
              Get early access
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-foreground/70 hover:text-foreground hover:bg-[--brand-surface] px-8 py-4 text-lg font-semibold bg-transparent transition-all duration-300"
            >
              <a
                href="#how-it-works"
                onClick={() =>
                  trackEvent("extension_clicked", { cta: "hero_extension" })
                }
              >
                <Chrome className="h-5 w-5" aria-hidden="true" />
                See How It Works
              </a>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
            <div className="flex flex-col items-center gap-2 p-4 bg-[--brand-surface] border border-[--brand-border] rounded-lg">
              <Users className="h-6 w-6 text-[--brand-orange]" aria-hidden="true" />
              <span className="text-sm font-medium">Crunchyroll Detection</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-[--brand-surface] border border-[--brand-border] rounded-lg">
              <MessageCircle
                className="h-6 w-6 text-[--brand-orange]"
                aria-hidden="true"
              />
              <span className="text-sm font-medium">Real-time Chat</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-[--brand-surface] border border-[--brand-border] rounded-lg">
              <Play className="h-6 w-6 text-[--brand-orange]" aria-hidden="true" />
              <span className="text-sm font-medium">Perfect Sync</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
