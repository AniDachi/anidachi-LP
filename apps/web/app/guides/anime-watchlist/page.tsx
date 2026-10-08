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
  title: "Anime Watchlist — Titles You Plan to Start",
  description:
    "An anime watchlist, including my anime watchlist, is the personal list of titles you plan to start. AniDachi records an episode only after you play it.",
  alternates: { canonical: "/guides/anime-watchlist" },
  openGraph: {
    title: "Anime Watchlist",
    description: "A plan-to-watch list, separate from episodes you have played.",
    url: "/guides/anime-watchlist",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Anime Watchlist",
    description: "Plan the titles. The player records the episode.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What is an anime watchlist?",
    answer:
      "A personal list of titles you intend to start. It is not a public ranking, and adding a title does not mark it watched.",
  },
  {
    question: "Is my anime watchlist the same thing?",
    answer:
      "Yes. That search is the same personal plan. Keep it on your account. Friends in a watchroom do not share the list.",
  },
  {
    question: "When does a watchlist title become progress?",
    answer:
      "When you open it on your own Crunchyroll or YouTube player in desktop Chrome. Recording needs your own Plus or Pro access and permission. Free can open saved history, Resume, and delete it.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "mine", label: "My anime watchlist", level: 2 },
  { id: "next", label: "Watchlist versus what you played", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AnimeWatchlistPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Anime tracker", url: "/anime-tracker" },
        { name: "Anime watchlist", url: "/guides/anime-watchlist" },
      ]}
      title="Anime watchlist"
      description="A personal plan-to-watch list for Crunchyroll and YouTube."
      url="/guides/anime-watchlist"
      datePublished="2026-10-08"
      dateModified="2026-10-08"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Anime watchlist for titles you plan to start</SeoGuideTitle>
      <h2 id="answer" className="scroll-mt-24">
        Short answer
      </h2>
      <SeoGuideAnswer>
        <p>
          An anime watchlist is the set of titles you mean to open later.{" "}
          <Link href="/anime-tracker">AniDachi</Link> does not treat that list
          as watched. Progress starts when the Crunchyroll episode or YouTube
          video is actually playing in desktop Chrome.
        </p>
      </SeoGuideAnswer>
      <h2 id="mine" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        My anime watchlist
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "Keep it personal",
            body: "This is your plan, not a group ranking and not a public profile.",
          },
          {
            title: "Keep it short enough to use",
            body: "The next few titles belong on the animes to watch list. The watchlist can be longer, but a huge one is hard to resume.",
          },
          {
            title: "Play it on your account",
            body: "Your own Crunchyroll login, or a full YouTube watch page. Shorts, embeds, and the mobile app are not the episode.",
          },
        ]}
      />
      <h2 id="next" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        A watchlist versus what you already played
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        The plan stays a plan until you press play. After that, Plus or Pro
        can record the episode when you have allowed it. YouTube recording is
        a separate permission. Free can still open saved history, Resume, and
        delete it. A friend’s room does not write your list. The next titles
        to start are on the{" "}
        <Link
          href="/guides/animes-to-watch-list"
          className="text-brand-orange hover:underline"
        >
          animes to watch list
        </Link>
        . What you finished belongs in the{" "}
        <Link href="/guides/anime-diary" className="text-brand-orange hover:underline">
          anime diary
        </Link>{" "}
        or on the{" "}
        <Link
          href="/guides/anime-checklist"
          className="text-brand-orange hover:underline"
        >
          anime checklist
        </Link>
        . Crunchyroll’s own episode list is{" "}
        <Link
          href="/crunchyroll-watch-history"
          className="text-brand-orange hover:underline"
        >
          Crunchyroll watch history
        </Link>
        , which is separate from AniDachi. Install from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          /extension
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          { href: "/anime-tracker", label: "Anime tracker" },
          { href: "/guides/animes-to-watch-list", label: "Animes to watch list" },
          { href: "/crunchyroll-watch-history", label: "Crunchyroll watch history" },
        ]}
      />
    </SeoPageLayout>
  );
}
