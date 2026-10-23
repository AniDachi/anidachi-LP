"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUpRight, X } from "lucide-react";
import { inferPageTemplateFromPath, trackConversion } from "@/lib/conversion-events";
import {
  PRODUCT_HUNT_URL,
  isProductHuntLaunchBarPath,
  isProductHuntLaunchOver,
} from "@/lib/product-hunt-launch";

const DISMISS_KEY = "anidachi_ph_launch_bar_dismissed";

/** Site-wide, dismissible launch-week strip asking visitors to upvote on Product Hunt. */
export function ProductHuntLaunchBar() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  // Static HTML is prerendered at deploy time, so the clock is only read after
  // hydration; reading it during render would mismatch once the launch ends.
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setExpired(isProductHuntLaunchOver(Date.now()));
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      // Storage blocked: keep showing the strip.
    }
  }, []);

  if (dismissed || expired || !isProductHuntLaunchBarPath(pathname)) return null;

  return (
    <div className="relative border-b border-ani-line bg-ani-panel text-ani-text">
      <div className="container mx-auto flex min-h-10 items-center justify-center gap-x-3 px-10 py-2 text-center text-sm">
        <a
          href={PRODUCT_HUNT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-wrap items-center justify-center gap-x-2 hover:text-ani-progress"
          onClick={() => {
            trackConversion("cta_click", {
              page_path: pathname,
              page_template: inferPageTemplateFromPath(pathname),
              placement: "launch_bar",
              cta_variant: "product_hunt_launch_bar",
            });
          }}
        >
          <span>
            🧡 We&apos;re live on Product Hunt
            <span className="hidden sm:inline">. An upvote helps a ton.</span>
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-ani-progress">
            Upvote
            <span className="hidden sm:inline"> AniDachi</span>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </a>
        <button
          type="button"
          aria-label="Dismiss Product Hunt banner"
          className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ani-muted hover:text-ani-text"
          onClick={() => {
            setDismissed(true);
            try {
              window.localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              // Storage blocked: dismissal lasts for this page view only.
            }
          }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
