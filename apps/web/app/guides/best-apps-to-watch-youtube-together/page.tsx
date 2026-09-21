import type { Metadata } from "next";
import Link from "next/link";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_COMPARE_OVERVIEW,
  PRICING_PLUS_PRICE_LINE,
  PRICING_IS_ANIDACHI_FREE_YOUTUBE_ANSWER,
} from "@/lib/pricing-copy";
import { INSTALL_CTA_LABEL, INSTALL_HUB_PATH } from "@/lib/install-cta";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Best Apps to Watch YouTube Together (2026 Ranked)",
  description:
    "Best apps to watch YouTube together: AniDachi (Chrome Web Store, live watchrooms), Watch2Gether (free live), Teleparty (multi-platform), Discord (voice only).",
  alternates: {
    canonical: "/guides/best-apps-to-watch-youtube-together",
  },
  openGraph: {
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "AniDachi – watch anime together, in perfect sync",
      },
    ],

    title: "Best Apps to Watch YouTube Together",
    description:
      "Ranked YouTube co-watch apps for 2026 — sync, async, and free options.",
    url: "/guides/best-apps-to-watch-youtube-together",
  },
  twitter: {
    images: ["/opengraph-image.png"],
    card: "summary_large_image",
    title: "Best Apps to Watch YouTube Together",
    description: "AniDachi, Watch2Gether, Teleparty, Discord — ranked.",
  },
};

const faq = [
  {
    question: "What is the best app to watch YouTube together?",
    answer:
      "AniDachi ranks first for groups that want Chrome extension watchrooms with live sync and personal history. Watch2Gether is the best free live-only browser room. Teleparty fits multi-platform live nights.",
  },
  {
    question: "Is there a free app to watch YouTube together?",
    answer:
      "Watch2Gether’s free tier and Discord voice are free. AniDachi has a Free tier for joining and limited hosting — see pricing for unlimited host rooms.",
  },
  {
    question: "Is AniDachi free?",
    answer: PRICING_IS_ANIDACHI_FREE_YOUTUBE_ANSWER,
  },
  {
    question: "Is AniDachi a watch together app / watch party app?",
    answer:
      "Yes. AniDachi is a Chrome Web Store watch-party extension for YouTube and Crunchyroll — not a new streaming catalog. Add to Chrome from /extension, then open a full YouTube video or a Crunchyroll episode.",
  },
  {
    question: "What is the best app to watch videos together?",
    answer:
      "For YouTube and Crunchyroll, AniDachi. Watch2Gether fits public YouTube links in a browser room. Teleparty fits live multi-brand nights. This page ranks YouTube; Crunchyroll compare lives on /watch-crunchyroll-together.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "verdict", label: "Verdict", level: 2 },
  { id: "table", label: "Comparison table", level: 2 },
  { id: "ranked", label: "Ranked list", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function BestAppsToWatchYoutubeTogetherPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["youtube", "pillar-watch-youtube"],
    excludeHref: "/guides/best-apps-to-watch-youtube-together",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "YouTube Watch Party", url: "/watch-youtube-together" },
        {
          name: "Best apps to watch YouTube together",
          url: "/guides/best-apps-to-watch-youtube-together",
        },
      ]}
      title="Best apps to watch YouTube together"
      description="Ranked YouTube co-watch apps — AniDachi, Watch2Gether, Teleparty, Discord."
      url="/guides/best-apps-to-watch-youtube-together"
      datePublished="2026-07-25"
      dateModified="2026-09-21"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Best Apps to Watch YouTube Together (2026)
      </h1>

      <h2
        id="verdict"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Verdict
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          The best app for most recurring YouTube groups is AniDachi — Add to
          Chrome from the official Store listing, then host watchrooms with live
          sync, chat, and personal history on full YouTube videos.
        </strong>{" "}
        {PRICING_COMPARE_OVERVIEW} Hub:{" "}
        <Link
          href="/watch-youtube-together"
          className="text-brand-orange hover:underline"
        >
          YouTube watch party
        </Link>
        .
      </p>

      <h2
        id="table"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Comparison table
      </h2>
      <ResponsiveCompareTable
        columns={[
          { id: "anidachi", label: "AniDachi", highlight: true },
          { id: "w2g", label: "Watch2Gether" },
          { id: "teleparty", label: "Teleparty" },
          { id: "discord", label: "Discord" },
        ]}
        rows={[
          {
            feature: "YouTube sync",
            values: {
              anidachi: "yes",
              w2g: "yes",
              teleparty: "yes",
              discord: "no (Go Live only)",
            },
          },
          {
            feature: "Async",
            values: {
              anidachi: "Planned",
              w2g: "no",
              teleparty: "no",
              discord: "no",
            },
          },
          {
            feature: "Built-in voice",
            values: {
              anidachi: "no",
              w2g: "no",
              teleparty: "Premium",
              discord: "yes",
            },
          },
          {
            feature: "Best for",
            values: {
              anidachi: "Watchrooms",
              w2g: "Free live",
              teleparty: "Multi-service",
              discord: "Voice",
            },
          },
          {
            feature: "Pricing",
            values: {
              anidachi: PRICING_PLUS_PRICE_LINE,
              w2g: "Free + paid",
              teleparty: "Freemium",
              discord: "Free",
            },
          },
        ]}
      />

      <PrimaryCheckoutCta
        pagePath="/guides/best-apps-to-watch-youtube-together"
        pageTemplate="guide"
        placement="content_mid"
        className="my-10"
      />

      <h2
        id="ranked"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Ranked list
      </h2>
      <ol className="list-decimal pl-6 space-y-3 text-foreground/80 mb-8">
        <li>
          <strong>#1 AniDachi</strong> — YouTube + Crunchyroll live watchrooms.
          <Link href={INSTALL_HUB_PATH} className="text-brand-orange hover:underline ml-1">
            {INSTALL_CTA_LABEL}
          </Link>
          .
        </li>
        <li>
          <strong>#2 Watch2Gether</strong> — best free live browser room.
        </li>
        <li>
          <strong>#3 Teleparty</strong> — if you already sync Netflix/Disney+.
        </li>
        <li>
          <strong>#4 Discord</strong> — voice companion, not the sync layer (
          <Link
            href="/guides/youtube-watch-party-with-discord"
            className="text-brand-orange hover:underline"
          >
            hybrid guide
          </Link>
          ).
        </li>
      </ol>

      <h2
        id="related"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Related
      </h2>
      <ul className="space-y-2 text-brand-orange">
        <li>
          <Link
            href="/guides/best-way-to-watch-youtube-with-friends"
            className="hover:underline"
          >
            Best way to watch YouTube with friends
          </Link>
        </li>
        <li>
          <Link
            href="/guides/how-to-watch-youtube-with-friends"
            className="hover:underline"
          >
            How to watch YouTube with friends
          </Link>
        </li>
        <li>
          <Link
            href="/guides/watch2gether-alternatives-for-youtube"
            className="hover:underline"
          >
            Watch2Gether alternatives for YouTube
          </Link>
        </li>
        <li>
          <Link
            href="/best-apps-watch-anime-together-long-distance"
            className="hover:underline"
          >
            Best apps to watch anime long distance
          </Link>
        </li>
        {relatedGuideLinks.map((g) => (
          <li key={g.href}>
            <Link href={g.href} className="hover:underline">
              {g.label}
            </Link>
          </li>
        ))}
      </ul>
    </SeoPageLayout>
  );
}
