import type { Metadata } from "next";
import { SectionIndexPage } from "@/components/section-index-page";
import { getWatchGroups } from "@/lib/section-index";

const url = "/watch";
const groups = getWatchGroups();
const titleCount = groups[1].entries.length + groups[2].entries.length;

export const metadata: Metadata = {
  title: "Watch Anime With Friends: Every Title A–Z",
  description:
    "Every anime with an AniDachi watch-with-friends page, A to Z, plus genre hubs and films. Episode counts, pacing tips and how to watch in sync.",
  alternates: { canonical: url },
  openGraph: {
    title: "Watch Anime With Friends: Every Title A–Z",
    description: "Every anime with a watch-with-friends page, plus genre hubs and films.",
    url,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Watch Anime With Friends: Every Title A–Z",
    description: "Every anime with a watch-with-friends page, plus genre hubs and films.",
    images: ["/opengraph-image.png"],
  },
};

export default function WatchIndexPage() {
  return (
    <SectionIndexPage
      url={url}
      name="Watch"
      heading="Watch anime with friends: every title"
      summary={`${titleCount} anime series and films with a page on watching them with friends.`}
      groups={groups}
      intro={
        <>
          <p>
            <strong>{titleCount} anime series and films</strong> with a page on watching them with
            friends: episode counts, pacing tips, and how to stay in sync. Browse by genre or
            find a title A to Z.
          </p>
        </>
      }
    />
  );
}
