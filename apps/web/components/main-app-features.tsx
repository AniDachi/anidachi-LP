"use client";

import { Users, MessageSquare, History, ArrowRight } from "lucide-react";
import Link from "next/link";
import { HomeSectionHeader } from "@/components/home-section-header";

const features = [
  {
    id: "async-watching",
    icon: Users,
    title: "Asynchronous group watching",
    benefit: "Never miss watching with friends again",
    description:
      "Create watchrooms and invite friends even when you're not online together. Everyone watches at their own pace — AniDachi tracks progress so no one falls behind.",
    link: "/guides/asynchronous-vs-live-watch-party",
    showLearnMore: true,
    featured: true,
  },
  {
    id: "chat",
    icon: MessageSquare,
    title: "Integrated chat and discussions",
    benefit: "Share every epic moment instantly",
    description:
      "React to plot twists and leave time-stamped comments your friends see when they catch up — every conversation stays on the episode.",
  },
  {
    id: "history",
    icon: History,
    title: "Personalized watch history",
    benefit: "Always know where you left off",
    description:
      "Track watch history across every room. See what friends have finished and pick up the right episode every time.",
  },
] as const;

export function MainAppFeatures() {
  const featured = features.find((f) => "featured" in f && f.featured)!;
  const secondary = features.filter((f) => !("featured" in f && f.featured));

  return (
    <section id="features" className="bg-background py-16 lg:py-24">
      <div className="container mx-auto px-4">
        <HomeSectionHeader
          title="Your watchroom hub"
          description="Crunchyroll anime nights and YouTube hangs — sync, chat, and progress on your schedule."
        />

        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-12 lg:gap-6">
          <article
            id={featured.id}
            className="relative overflow-hidden rounded-2xl border border-brand-border/80 bg-brand-surface p-6 sm:p-8 lg:col-span-7 lg:p-10"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_0%_0%,oklch(0.71_0.20_45_/_0.12),transparent_55%)]"
            />
            <div className="relative">
              <featured.icon
                className="mb-5 h-7 w-7 text-brand-orange"
                aria-hidden="true"
              />
              <h3 className="mb-2 text-2xl font-bold tracking-[-0.02em] text-foreground md:text-3xl">
                {featured.title}
              </h3>
              <p className="mb-3 text-sm font-medium text-brand-orange-bright">
                {featured.benefit}
              </p>
              <p className="max-w-xl text-[0.95rem] leading-relaxed text-foreground/70 md:text-base">
                {featured.description}
              </p>
              {"showLearnMore" in featured && featured.showLearnMore ? (
                <Link
                  href={featured.link}
                  className="group/btn mt-6 inline-flex items-center text-sm font-medium text-brand-orange transition-colors hover:text-brand-orange-bright"
                >
                  Learn more
                  <ArrowRight
                    className="ml-1 h-4 w-4 transition-transform duration-200 ease-out group-hover/btn:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              ) : null}
            </div>
          </article>

          <div className="flex flex-col gap-5 lg:col-span-5">
            {secondary.map((feature) => (
              <article
                key={feature.id}
                id={feature.id}
                className="rounded-2xl border border-brand-border/70 bg-brand-surface/60 p-6 transition-[border-color,background-color] duration-200 hover:border-brand-border hover:bg-brand-surface"
              >
                <feature.icon
                  className="mb-3 h-5 w-5 text-brand-orange/90"
                  aria-hidden="true"
                />
                <h3 className="mb-1 text-lg font-semibold tracking-[-0.01em] text-foreground">
                  {feature.title}
                </h3>
                <p className="mb-2 text-sm font-medium text-foreground/55">
                  {feature.benefit}
                </p>
                <p className="text-sm leading-relaxed text-foreground/70">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
