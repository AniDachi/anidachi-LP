"use client";

import { useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, MessageSquare, History, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { trackConversion } from "@/lib/conversion-events";
import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";

export function MainAppFeatures() {
  const bottomCtaFired = useRef(false);
  const bottomCtaRef = useRef<HTMLDivElement>(null);
  const { openSurvey } = usePlanSurvey();

  useEffect(() => {
    const el = bottomCtaRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      if (!bottomCtaFired.current) {
        bottomCtaFired.current = true;
        trackConversion("cta_impression", {
          page_path: "/",
          page_template: "home",
          placement: "home_features",
          cta_variant: "home_features_pricing",
        });
      }
      return;
    }
    const ob = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !bottomCtaFired.current) {
            bottomCtaFired.current = true;
            trackConversion("cta_impression", {
              page_path: "/",
              page_template: "home",
              placement: "home_features",
              cta_variant: "home_features_pricing",
            });
            ob.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  const features = [
    {
      id: "async-watching",
      icon: Users,
      title: "Asynchronous Group Watching",
      benefit: "Never miss watching with friends again",
      description:
        "Create watchrooms and invite friends to watch anime together, even when you're not online at the same time. Everyone watches at their own pace — AniDachi tracks individual progress so no one falls behind. Pick up where you left off, mark episodes as watched, and stay synchronized without scheduling conflicts. Perfect for friend groups across different time zones.",
      link: "/guides/asynchronous-vs-live-watch-party",
      color: "purple",
    },
    {
      id: "chat",
      icon: MessageSquare,
      title: "Integrated Chat and Discussions",
      benefit: "Share every epic moment instantly",
      description:
        "React to your favorite moments, discuss plot twists, and share theories with built-in real-time chat and discussion threads for each episode. Leave time-stamped reactions that your friends see when they catch up. Whether you're debating the latest Attack on Titan reveal or sharing One Piece memes, every conversation stays attached to the episode.",
      link: "/watch-anime-together",
      color: "blue",
    },
    {
      id: "history",
      icon: History,
      title: "Personalized Watch History",
      benefit: "Discover your next favorite anime",
      description:
        "Track your anime journey with detailed watch history and progress tracking across all your watchrooms. See what your friends have watched, compare notes on completed series, and keep a permanent record of your anime adventures. Never lose track of which episode you're on, even across multiple shows.",
      link: "/watch-anime-together",
      color: "green",
    },
  ];

  const getColorClasses = (_color: string) => {
    return "bg-[--brand-orange]/15 text-[--brand-orange] group-hover:bg-[--brand-orange] group-hover:text-[--primary-foreground]";
  };

  return (
    <section
      id="features"
      className="py-24 bg-background"
    >
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[--brand-orange]/15 border border-[--brand-orange]/30 text-[--brand-orange] px-4 py-2 rounded-full text-sm font-medium mb-4">
            <span className="w-2 h-2 bg-[--brand-orange] rounded-full animate-pulse" />
            Features
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            Your Asynchronous Anime Hub
          </h2>
          <p className="text-xl text-foreground/70 max-w-3xl mx-auto">
            Transform solo viewing into shared experiences with powerful
            features designed for anime lovers who want to watch Crunchyroll
            together
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
          {features.map((feature) => (
            <Card
              key={feature.id}
              id={feature.id}
              className="group border border-[--brand-border] shadow-lg hover:shadow-2xl hover:border-[--brand-orange]/40 transition-all duration-500 hover:-translate-y-2 bg-[--brand-surface] p-6"
            >
              <CardHeader className="p-0">
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center mb-2 transition-all duration-300 ${getColorClasses(
                    feature.color,
                  )}`}
                >
                  <feature.icon
                    className="h-7 w-7 transition-colors duration-300"
                    aria-hidden="true"
                  />
                </div>
                <CardTitle className="text-xl font-bold text-foreground mb-2">
                  {feature.title}
                </CardTitle>
                <div className="text-sm font-medium text-[--brand-orange] mb-3">
                  {feature.benefit}
                </div>
              </CardHeader>
              <CardContent className="p-0 pt-4">
                <CardDescription className="text-foreground/70 text-base leading-relaxed mb-4">
                  {feature.description}
                </CardDescription>
                <Button
                  variant="ghost"
                  className="text-[--brand-orange] hover:text-[--brand-orange-bright] p-0 h-auto font-medium group/btn"
                  asChild
                >
                  <Link href={feature.link}>
                    Learn more
                    <ArrowRight
                      className="ml-1 h-4 w-4 transition-transform group-hover/btn:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center" ref={bottomCtaRef}>
          <Button
            size="lg"
            className="bg-[--brand-orange] hover:bg-[--brand-orange-deep] text-[--primary-foreground] px-8 py-4 text-lg font-semibold shadow-lg glow-orange hover:glow-orange-lg transition-all duration-300"
            asChild
          >
            <Link
              href="#pricing"
              onClick={(e) => {
                e.preventDefault();
                trackConversion("cta_click", {
                  page_path: "/",
                  page_template: "home",
                  placement: "home_features",
                  cta_variant: "home_features_pricing",
                });
                openSurvey({
                  placement: "home_features",
                  ctaVariant: "home_features_pricing",
                });
              }}
            >
              Get early access
              <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
