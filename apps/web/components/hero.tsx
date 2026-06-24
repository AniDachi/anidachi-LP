"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Chrome, MessageCircle, Play, Rocket, Users } from "lucide-react";
import { trackEvent } from "@/lib/gtag";
import { trackConversion } from "@/lib/conversion-events";
import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";

export function Hero() {
  const { openSurvey, recommendedTier, survey } = usePlanSurvey();

  useEffect(() => {
    trackConversion("cta_impression", {
      page_path: "/",
      page_template: "home",
      placement: "hero",
      cta_variant: "hero_waitlist_early_access",
    });
  }, []);

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-blue-800 text-white">
      <div className="absolute inset-0 motion-reduce:hidden">
        <div className="absolute top-20 left-10 w-20 h-20 bg-purple-400/20 rounded-full blur-lg md:blur-xl motion-reduce:animate-none animate-pulse" />
        <div className="absolute top-40 right-20 w-32 h-32 bg-blue-400/20 rounded-full blur-lg md:blur-xl motion-reduce:animate-none animate-pulse delay-1000" />
        <div className="absolute bottom-20 left-1/3 w-24 h-24 bg-purple-300/20 rounded-full blur-lg md:blur-xl motion-reduce:animate-none animate-pulse delay-500" />
      </div>

      <div className="absolute inset-0 bg-black/20" />
      <div className="relative container mx-auto px-4 py-24 lg:py-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Pre-launch status pill */}
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/25 text-white px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            Launching soon &middot; 800+ people already on the waitlist
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
            Your friends are watching without you. Fix that.
          </h1>
          <p className="text-xl md:text-2xl mb-4 text-purple-100 max-w-3xl mx-auto leading-relaxed">
            Sync with your crew across any timezone. Create a watchroom, share
            the link, react to every plot twist — even when you don&apos;t watch
            at the same time.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button
              size="touch"
              className="bg-white text-purple-700 hover:bg-purple-50 w-full sm:w-auto px-8 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 md:hover:scale-105"
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
              className="text-purple-100 hover:text-white hover:bg-white/10 px-8 py-4 text-lg font-semibold bg-transparent backdrop-blur-sm transition-all duration-300"
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
            <div className="flex flex-col items-center gap-2 p-4 bg-white/10 backdrop-blur-sm rounded-lg">
              <Users className="h-6 w-6 text-purple-200" aria-hidden="true" />
              <span className="text-sm font-medium">Crunchyroll Detection</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-white/10 backdrop-blur-sm rounded-lg">
              <MessageCircle
                className="h-6 w-6 text-purple-200"
                aria-hidden="true"
              />
              <span className="text-sm font-medium">Real-time Chat</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-white/10 backdrop-blur-sm rounded-lg">
              <Play className="h-6 w-6 text-purple-200" aria-hidden="true" />
              <span className="text-sm font-medium">Perfect Sync</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
