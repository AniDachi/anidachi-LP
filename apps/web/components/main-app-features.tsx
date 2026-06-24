"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, MessageSquare, History, ArrowRight } from "lucide-react";
import Link from "next/link";

export function MainAppFeatures() {
  const features = [
    {
      id: "async-watching",
      icon: Users,
      title: "Asynchronous Group Watching",
      benefit: "Never miss watching with friends again",
      description:
        "Create watchrooms and invite friends even when you're not online together. Everyone watches at their own pace — AniDachi tracks progress so no one falls behind.",
      link: "/guides/asynchronous-vs-live-watch-party",
      showLearnMore: true,
    },
    {
      id: "chat",
      icon: MessageSquare,
      title: "Integrated Chat and Discussions",
      benefit: "Share every epic moment instantly",
      description:
        "React to plot twists and leave time-stamped comments your friends see when they catch up — every conversation stays on the episode.",
    },
    {
      id: "history",
      icon: History,
      title: "Personalized Watch History",
      benefit: "Always know where you left off",
      description:
        "Track watch history across every room. See what friends have finished and pick up the right episode every time.",
    },
  ];

  const getColorClasses = () =>
    "bg-brand-surface border border-brand-border text-foreground/60 group-hover:bg-brand-orange group-hover:border-brand-orange group-hover:text-primary-foreground";

  return (
    <section id="features" className="bg-background py-16 lg:py-20">
      <div className="container mx-auto px-4">
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-orange/30 bg-brand-orange/15 px-4 py-2 text-sm font-medium text-brand-orange">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-orange" />
            Features
          </div>
          <h2 className="mb-3 text-3xl font-bold text-foreground md:text-5xl">
            Your Asynchronous Anime Hub
          </h2>
          <div className="mx-auto mb-3 h-0.5 w-12 rounded-full bg-gradient-to-r from-brand-orange to-brand-orange-bright" />
          <p className="mx-auto max-w-xl text-base text-foreground/70">
            Watch together on your schedule — sync, chat, and progress built in.
          </p>
        </div>

        <div className="mx-auto mb-8 grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Card
              key={feature.id}
              id={feature.id}
              className="group animate-fade-in-up border border-brand-border bg-brand-surface p-5 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-orange/40 hover:shadow-xl"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="p-0">
                <div
                  className={`mb-2 flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 ${getColorClasses()}`}
                >
                  <feature.icon
                    className="h-6 w-6 transition-colors duration-300"
                    aria-hidden="true"
                  />
                </div>
                <CardTitle className="mb-1 text-lg font-bold text-foreground">
                  {feature.title}
                </CardTitle>
                <div className="mb-2 text-sm font-medium text-foreground/60 transition-colors duration-300 group-hover:text-brand-orange">
                  {feature.benefit}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <CardDescription className="text-sm leading-relaxed text-foreground/70">
                  {feature.description}
                </CardDescription>
                {feature.showLearnMore ? (
                  <Link
                    href={feature.link!}
                    className="group/btn mt-3 inline-flex items-center text-sm font-medium text-brand-orange hover:text-brand-orange-bright"
                  >
                    Learn more
                    <ArrowRight
                      className="ml-1 h-4 w-4 transition-transform group-hover/btn:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
