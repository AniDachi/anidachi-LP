import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title:
    "AniDachi vs Anime Watch Parties Extension — Crunchyroll Co-Watching Compared",
  description:
    "Compare AniDachi with an “anime watch parties” style extension: Crunchyroll-first live rooms, chat, personal history, and setup friction.",
  alternates: { canonical: "/compare/anidachi-vs-anime-watch-parties-extension" },
  openGraph: {
    title: "AniDachi vs Anime Watch Parties Extension (2026)",
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
      "AniDachi combines live Crunchyroll and YouTube rooms with anime detection, chat, reactions, and voice/video. Your own Plus/Pro access and recording permission enable personal history. Async catch-up, persistent room chat, and shared group progress are coming soon.",
  },
  {
    question: "Can AniDachi replace Discord voice chat?",
    answer:
      "AniDachi has built-in voice and video during live rooms. You can also keep Discord for voice if your group prefers it; choose one voice channel to avoid duplicate audio.",
  },
];

const headings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
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
      dateModified="2026-10-01"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        AniDachi vs an “Anime Watch Parties” extension
      </h1>
      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          AniDachi brings live sync, chat, reactions, and voice/video into your
          Crunchyroll or YouTube viewing session, with personal history available
          through each viewer’s own Plus or Pro access.
        </strong>
      </p>

      <h2 id="tldr" className="text-2xl font-bold text-foreground mt-10 mb-3 scroll-mt-24">
        At a glance
      </h2>
      <p className="text-foreground/80 mb-8">
        <strong>TL;DR:</strong> If you only need basic live sync, a simple extension can be
        enough. Choose AniDachi when you want anime detection, in-room social features,
        and personal history alongside your live viewing.
      </p>

      <h2
        id="comparison"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        What to compare
      </h2>
      <ul className="list-disc pl-6 text-foreground/80 space-y-2 mb-8">
        <li>
          <strong>Live setup:</strong> can everyone open the same episode and join at the agreed time?
        </li>
        <li>
          <strong>Personal history:</strong> what subscription and recording permission does each viewer need?
        </li>
        <li>
          <strong>Anime detection:</strong> does setup stay consistent across episodes?
        </li>
        <li>
          <strong>Social features:</strong> are chat, reactions, and voice/video available beside the player?
        </li>
      </ul>

      <h2
        id="recommendation"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Which to choose
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-8">
        If your group watches occasionally and always live, start simple. For weekly
        anime nights, AniDachi offers hosting with Plus or Pro, including a trial,
        while Free friends can join. Pricing and checkout live on{" "}
        <Link href="/#pricing" className="text-brand-orange font-medium hover:underline">
          the homepage
        </Link>
        .
      </p>

      <h2 id="related" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Related
      </h2>
      <ul className="space-y-2 text-brand-orange mb-8">
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
