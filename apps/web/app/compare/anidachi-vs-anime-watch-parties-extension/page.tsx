import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title:
    "AniDachi vs Anime Watch Parties Extension — Crunchyroll Co-Watching Compared",
  description:
    "Compare AniDachi with an “anime watch parties” style extension: Crunchyroll-first watchrooms, async catch-up, progress tracking, and setup friction.",
  alternates: { canonical: "/compare/anidachi-vs-anime-watch-parties-extension" },
  openGraph: {
    title: "AniDachi vs Anime Watch Parties Extension",
    description:
      "Side-by-side comparison for Crunchyroll-first anime groups and weekly watch nights.",
    url: "/compare/anidachi-vs-anime-watch-parties-extension",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi vs Anime Watch Parties Extension",
    description: "Which workflow is best for Crunchyroll anime nights?",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "What makes AniDachi different from generic watch party extensions?",
    answer:
      "AniDachi is built around Crunchyroll anime nights: watchrooms that persist for a series, anime detection, optional async catch-up, and per-person progress tracking. Generic extensions often focus on live sync only.",
  },
  {
    question: "Can AniDachi replace Discord voice chat?",
    answer:
      "No—you can keep Discord for voice. AniDachi focuses on synced playback, watchrooms, and episode context on top of Crunchyroll tabs.",
  },
];

const headings: TocHeading[] = [
  { id: "tldr", label: "At a glance", level: 2 },
  { id: "comparison", label: "What to compare", level: 2 },
  { id: "recommendation", label: "Which to choose", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AniDachiVsAnimeWatchPartiesExtensionPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Compare", url: "/watch-crunchyroll-together" },
        {
          name: "AniDachi vs Anime Watch Parties extension",
          url: "/compare/anidachi-vs-anime-watch-parties-extension",
        },
      ]}
      title="AniDachi vs Anime Watch Parties extension"
      description="Compare Crunchyroll-first watchrooms with generic watch-party extension workflows."
      url="/compare/anidachi-vs-anime-watch-parties-extension"
      datePublished="2026-05-11"
      dateModified="2026-05-11"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-gray-900 mb-6">
        AniDachi vs an “Anime Watch Parties” extension
      </h1>

      <p className="text-xl text-gray-700 leading-relaxed mb-8">
        <strong>
          Many extensions help you press play together. AniDachi is designed for what
          happens after episode one: long shows, friends falling behind, and spoiler-safe
          weekly group watching on Crunchyroll.
        </strong>
      </p>

      <h2 id="tldr" className="text-2xl font-bold text-gray-900 mt-10 mb-3 scroll-mt-24">
        At a glance
      </h2>
      <p className="text-gray-700 mb-8">
        <strong>TL;DR:</strong> If you only need basic live sync, a simple extension can be
        enough. If your group needs a persistent watchroom, anime detection, and optional
        async catch-up, choose AniDachi.
      </p>

      <h2
        id="comparison"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        What to compare
      </h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-8">
        <li>
          <strong>Async support:</strong> can friends watch later without losing the room?
        </li>
        <li>
          <strong>Progress:</strong> does the room track where each person is?
        </li>
        <li>
          <strong>Anime detection:</strong> does setup stay consistent across episodes?
        </li>
        <li>
          <strong>Spoiler hygiene:</strong> is chat episode-scoped or a single scroll?
        </li>
      </ul>

      <h2
        id="recommendation"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Which to choose
      </h2>
      <p className="text-gray-700 leading-relaxed mb-8">
        If your group watches occasionally and always live, start simple. If you host weekly
        anime nights, want async catch-up, and don’t want to manage spoilers manually, AniDachi
        is built for that workflow. Pricing and checkout live on{" "}
        <Link href="/#pricing" className="text-purple-600 font-medium hover:underline">
          the homepage
        </Link>
        .
      </p>

      <h2 id="related" className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24">
        Related
      </h2>
      <ul className="space-y-2 text-purple-600 mb-8">
        <li>
          <Link href="/watch-crunchyroll-together" className="hover:underline">
            Watch Crunchyroll Together
          </Link>
        </li>
        <li>
          <Link href="/guides/crunchyroll-watch-party-chrome-extension" className="hover:underline">
            Best Crunchyroll watch party Chrome extensions
          </Link>
        </li>
      </ul>
    </SeoPageLayout>
  );
}

