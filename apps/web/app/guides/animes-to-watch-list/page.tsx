import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideRelated,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

export const metadata: Metadata = {
  title: "Animes to Watch List — Queue Titles, Then Track Them",
  description:
    "Build an animes to watch list, then let AniDachi record the Crunchyroll episode or YouTube video you actually start.",
  alternates: { canonical: "/guides/animes-to-watch-list" },
  openGraph: {
    title: "Animes to Watch List",
    description: "A personal queue that turns into saved watch progress.",
    url: "/guides/animes-to-watch-list",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Animes to Watch List",
    description: "Queue titles, then track the ones you play.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "How do I keep an animes to watch list?",
    answer:
      "Write down the titles you want to start. When you open one on Crunchyroll or YouTube in desktop Chrome, AniDachi can save your place if you are on Plus or Pro.",
  },
  {
    question: "Is this the same as a list of anime to watch with friends?",
    answer:
      "No. A with-friends list is about what a group should pick. This page is your personal queue. Group picks live on the best anime to watch with friends guide.",
  },
  {
    question: "Will AniDachi mark a title watched if I only add it to a list?",
    answer:
      "No. Opening a room link or typing a title does not count as watching. Progress comes from your own Crunchyroll or YouTube player.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "how", label: "How to use the list", level: 2 },
  { id: "watchlist", label: "Watchlist vs watched", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AnimesToWatchListPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Anime tracker", url: "/anime-tracker" },
        { name: "Animes to watch list", url: "/guides/animes-to-watch-list" },
      ]}
      title="Animes to watch list"
      description="A personal queue that feeds AniDachi watch progress."
      url="/guides/animes-to-watch-list"
      datePublished="2026-09-26"
      dateModified="2026-09-26"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Animes to watch list</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          Keep a short queue of titles you mean to start. When you actually
          press play on Crunchyroll or YouTube,{" "}
          <Link href="/anime-tracker">AniDachi’s anime tracker</Link> can save
          the episode or video so you know where you stopped.
        </p>
      </SeoGuideAnswer>
      <h2 id="how" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        How to use the list
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "Pick a few titles",
            body: "Three to five is enough. A huge backlog is harder to resume.",
          },
          {
            title: "Open the real player",
            body: "Use your own Crunchyroll account or a full YouTube watch page in desktop Chrome.",
          },
          {
            title: "Save the place",
            body: "Plus or Pro records progress. Free can still open saved history and Resume.",
          },
        ]}
      />
      <h2 id="watchlist" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Anime watchlist versus what you already watched
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        A watchlist is what you intend to start. A watched list is what you
        finished. Keep them apart. When you press play, the tracker records the
        episode. Adding a title to a note does not mark it watched.
      </p>
      <p className="mb-6 leading-relaxed text-ani-muted">
        If the list is for a group night, start from{" "}
        <Link
          href="/guides/best-anime-to-watch-with-friends"
          className="text-brand-orange hover:underline"
        >
          best anime to watch with friends
        </Link>{" "}
        and install from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          /extension
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          { href: "/anime-tracker", label: "Anime tracker" },
          { href: "/watch-anime-together", label: "Watch anime together" },
        ]}
      />
    </SeoPageLayout>
  );
}
