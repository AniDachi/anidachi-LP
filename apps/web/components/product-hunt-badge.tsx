"use client";

import { trackConversion } from "@/lib/conversion-events";
import { PRODUCT_HUNT_URL } from "@/lib/product-hunt-launch";

const PRODUCT_HUNT_BADGE_SRC =
  "https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1207100&theme=dark&t=1792741563751";

/** Official "Featured on Product Hunt" badge (live upvote count). */
export function ProductHuntBadge({
  placement,
  pagePath,
  className,
}: {
  placement: string;
  pagePath: string;
  className?: string;
}) {
  return (
    <a
      href={PRODUCT_HUNT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => {
        trackConversion("cta_click", {
          page_path: pagePath,
          page_template: "home",
          placement,
          cta_variant: "product_hunt_badge",
        });
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- remote SVG badge with live upvote count */}
      <img
        src={PRODUCT_HUNT_BADGE_SRC}
        alt="AniDachi - Crunchyroll, YouTube & Netflix watch parties with friends | Product Hunt"
        width={250}
        height={54}
      />
    </a>
  );
}
