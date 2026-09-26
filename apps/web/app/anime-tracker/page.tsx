import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideRelated,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { PRICING_PLUS_VS_PRO_ANSWER } from "@/lib/pricing-copy";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

export const metadata: Metadata = {
  title: "Anime Tracker — Log Crunchyroll and YouTube Progress",
  description:
    "AniDachi is an anime tracker for what you actually play. Plus or Pro saves the Crunchyroll episode or YouTube video and lets you resume it.",
  alternates: { canonical: "/anime-tracker" },
  openGraph: {
    title: "Anime Tracker for Crunchyroll and YouTube",
    description:
      "Record the title and episode you play, then resume from the Chrome extension.",
    url: "/anime-tracker",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Anime Tracker for Crunchyroll and YouTube",
    description: "Personal watch progress on Crunchyroll and YouTube.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Is AniDachi an anime tracker?",
    answer:
      "Yes. While you watch on Crunchyroll or a full YouTube video, AniDachi detects the title and saves your place. Plus or Pro records and edits that progress. Saved history and Resume stay available on Free.",
  },
  {
    question: "Does AniDachi replace MyAnimeList or AniList?",
    answer:
      "No. Those are community lists. AniDachi logs what you actually play in desktop Chrome on Crunchyroll and YouTube, then lets you resume it.",
  },
  {
    question: "Who can save watch progress?",
    answer: PRICING_PLUS_VS_PRO_ANSWER,
  },
  {
    question: "Can a group share one watch history?",
    answer:
      "No. Each person has their own history. A paid host does not give guests that history. Async catch-up is planned, not available today.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "what-it-saves", label: "Episode tracker", level: 2 },
  { id: "plans", label: "Free, Plus, and Pro", level: 2 },
  { id: "queue", label: "Start a queue", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AnimeTrackerPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Anime tracker", url: "/anime-tracker" },
      ]}
      title="Anime tracker"
      description="Personal Crunchyroll and YouTube progress with AniDachi."
      url="/anime-tracker"
      datePublished="2026-09-26"
      dateModified="2026-09-26"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
      itemList={[
        {
          name: "Animes to watch list",
          url: "/guides/animes-to-watch-list",
          position: 1,
        },
        {
          name: "Watch anime together",
          url: "/watch-anime-together",
          position: 2,
        },
      ]}
    >
      <SeoGuideTitle>Anime tracker for what you actually play</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          AniDachi tracks the Crunchyroll episode or YouTube video you have open
          in desktop Chrome. Plus or Pro saves that place so you can resume it
          from the extension. It is your own log, not a public anime list.
        </p>
      </SeoGuideAnswer>

      <h2 id="what-it-saves" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Anime episode tracker, not a public list
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "Crunchyroll",
            body: "The title and episode you are watching on a catalog page.",
          },
          {
            title: "YouTube",
            body: "A full youtube.com/watch video. Shorts, embeds, and the mobile app are not tracked.",
          },
          {
            title: "Your account only",
            body: "Friends do not share one history. Each viewer’s Plus or Pro plan records their own progress.",
          },
        ]}
      />

      <h2 id="plans" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Free, Plus, and Pro
      </h2>
      <p className="mb-8 leading-relaxed text-ani-muted">
        Free can open saved history and Resume. Recording and editing progress
        needs your own Plus or Pro plan. Async catch-up is planned, not
        available today. Details are on{" "}
        <Link href="/pricing" className="text-brand-orange hover:underline">
          pricing
        </Link>
        .
      </p>

      <h2 id="queue" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Start a queue
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        A tracker is more useful when you already know what you want to start.
        Build that queue on the{" "}
        <Link
          href="/guides/animes-to-watch-list"
          className="text-brand-orange hover:underline"
        >
          animes to watch list
        </Link>
        , then open the title on Crunchyroll or YouTube and install AniDachi
        from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          the Chrome extension page
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          { href: "/watch-anime-together", label: "Watch anime together" },
          { href: "/watch-crunchyroll-together", label: "Crunchyroll watch party" },
          { href: "/watch-youtube-together", label: "YouTube watch party" },
        ]}
      />
    </SeoPageLayout>
  );
}
