import type { Metadata } from "next";
import { SectionIndexPage } from "@/components/section-index-page";
import { COMPARE_ENTRIES } from "@/lib/section-index";

const url = "/compare";
const groups = [{ id: "comparisons", heading: "Comparisons", entries: COMPARE_ENTRIES }];

export const metadata: Metadata = {
  title: "Watch Party Apps Compared for Anime Nights",
  description:
    "AniDachi compared with Teleparty, Crunchyroll Party, Rave, Watch2Gether, Kosmi, SyncUp and more: how each syncs, what it supports and when to pick it.",
  alternates: { canonical: url },
  openGraph: {
    title: "Watch Party Apps Compared for Anime Nights",
    description: "AniDachi vs Teleparty, Crunchyroll Party, Rave, Watch2Gether, Kosmi, SyncUp and more.",
    url,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Watch Party Apps Compared for Anime Nights",
    description: "AniDachi vs Teleparty, Crunchyroll Party, Rave, Watch2Gether, Kosmi, SyncUp and more.",
    images: ["/opengraph-image.png"],
  },
};

export default function CompareIndexPage() {
  return (
    <SectionIndexPage
      url={url}
      name="Compare"
      heading="Watch party apps compared"
      summary={`${COMPARE_ENTRIES.length} side-by-side comparisons of AniDachi and other ways to watch together.`}
      groups={groups}
      intro={
        <>
          <p>
            <strong>{COMPARE_ENTRIES.length} side-by-side comparisons</strong> of AniDachi and other ways
            to watch together. Each one covers how the tool syncs, which sites it supports, and when
            the other tool is the better pick. Competitor details cite their own sites.
          </p>
        </>
      }
    />
  );
}
