"use client";

import { History, LayoutGrid, Play } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HomeSectionHeader } from "@/components/home-section-header";
import { trackConversion } from "@/lib/conversion-events";
import {
  INSTALL_CTA_LABEL,
  INSTALL_HUB_PATH,
} from "@/lib/install-cta";

const features = [
  {
    id: "live-sync",
    icon: Play,
    title: "Live sync on your player",
    benefit: "Same episode, same moment — on your own stream",
    description:
      "AniDachi detects the Crunchyroll or YouTube title, you create a room, and friends join on their own player. Playback stays synced without screen share.",
    featured: true,
    showInstallCta: true,
  },
  {
    id: "overlay",
    icon: LayoutGrid,
    title: "Overlay chat, reactions, and layout",
    benefit: "Everything stays on the video",
    description:
      "Chat and reactions sit on the player. Drag cameras and chat where you want them — no Discord window dance beside a compressed share.",
  },
  {
    id: "history",
    icon: History,
    title: "Watch history that sticks",
    benefit: "Always know where you left off",
    description:
      "Personal watch history and Resume keep your place across rooms — pick up the right episode next time, whether you host or join.",
  },
] as const;

export function MainAppFeatures() {
  const featured = features.find((f) => "featured" in f && f.featured)!;
  const secondary = features.filter((f) => !("featured" in f && f.featured));

  return (
    <section id="features" className="bg-ani-canvas py-16 lg:py-24">
      <div className="container mx-auto px-4">
        <HomeSectionHeader
          title="Your watchroom hub"
          description="Crunchyroll anime nights and YouTube hangs — synced playback, overlay chat, cameras, and push-to-talk on your real player."
        />

        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-12 lg:gap-6">
          <article
            id={featured.id}
            className="rounded-[20px] border border-ani-line bg-ani-panel p-6 sm:p-8 lg:col-span-7 lg:p-10"
          >
            <featured.icon
              className="mb-5 h-7 w-7 text-ani-progress"
              aria-hidden="true"
            />
            <h3 className="mb-2 text-2xl font-semibold tracking-[-0.02em] text-ani-text md:text-3xl">
              {featured.title}
            </h3>
            <p className="mb-3 text-sm font-medium text-ani-muted">
              {featured.benefit}
            </p>
            <p className="max-w-xl text-[0.95rem] leading-relaxed text-ani-muted md:text-base">
              {featured.description}
            </p>
            {"showInstallCta" in featured && featured.showInstallCta ? (
              <Button
                variant="cream"
                size="control"
                className="mt-6 w-full px-8 text-sm sm:w-auto"
                asChild
              >
                <Link
                  href={INSTALL_HUB_PATH}
                  onClick={() => {
                    trackConversion("cta_click", {
                      page_path: "/",
                      page_template: "home",
                      placement: "home_features",
                      cta_variant: "features_install",
                    });
                  }}
                >
                  {INSTALL_CTA_LABEL}
                </Link>
              </Button>
            ) : null}
          </article>

          <div className="flex flex-col gap-5 lg:col-span-5">
            {secondary.map((feature) => (
              <article
                key={feature.id}
                id={feature.id}
                className="rounded-[20px] border border-ani-line p-6"
              >
                <feature.icon
                  className="mb-3 h-5 w-5 text-ani-progress"
                  aria-hidden="true"
                />
                <h3 className="mb-1 text-lg font-semibold tracking-[-0.02em] text-ani-text">
                  {feature.title}
                </h3>
                <p className="mb-2 text-sm font-medium text-ani-muted">
                  {feature.benefit}
                </p>
                <p className="text-sm leading-relaxed text-ani-muted">
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
