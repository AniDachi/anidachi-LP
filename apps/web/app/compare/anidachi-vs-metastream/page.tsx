import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_COMPARE_OVERVIEW,
  PRICING_FREE_TIER_TABLE,
} from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "AniDachi vs Metastream — Best Metastream Alternative for Anime (2026)",
  description:
    "AniDachi vs Metastream for Crunchyroll anime nights: per-user sync vs tab streaming, async watchrooms, and when to pick each tool.",
  alternates: { canonical: "/compare/anidachi-vs-metastream" },
  openGraph: {
    title: "AniDachi vs Metastream for Anime Watch Parties",
    description:
      "Compare Metastream's browser tab streaming with AniDachi's Crunchyroll-first watchrooms.",
    url: "/compare/anidachi-vs-metastream",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi vs Metastream — Anime Comparison",
    description: "Metastream alternative for Crunchyroll anime groups.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Is Metastream good for Crunchyroll anime?",
    answer:
      "Metastream syncs browser tabs for live co-watching across many sites, including Crunchyroll. It works for casual live hangs but lacks anime-specific async watchrooms, auto anime detection, and per-episode spoiler controls that AniDachi provides.",
  },
  {
    question: "What is the best Metastream alternative for anime?",
    answer:
      "AniDachi is the strongest Metastream alternative for Crunchyroll-first anime groups — especially clubs that need async catch-up when schedules do not align.",
  },
  {
    question: "Does Metastream require everyone to watch live?",
    answer:
      "Yes. Metastream is built for live synchronized tab playback. There is no async mode where members catch up on different days inside the same spoiler-safe room.",
  },
  {
    question: "How does AniDachi pricing compare?",
    answer: PRICING_COMPARE_OVERVIEW,
  },
];

const headings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "tldr", label: "At a glance", level: 2 },
  { id: "feature-comparison", label: "Feature comparison", level: 2 },
  { id: "when-metastream", label: "When Metastream wins", level: 2 },
  { id: "when-anidachi", label: "When AniDachi wins", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AniDachiVsMetastreamPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["crunchyroll", "watch-party", "compare"],
    limit: 3,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Compare", url: "/watch-crunchyroll-together" },
        { name: "AniDachi vs Metastream", url: "/compare/anidachi-vs-metastream" },
      ]}
      title="AniDachi vs Metastream"
      description="Side-by-side comparison for Crunchyroll anime watch parties."
      url="/compare/anidachi-vs-metastream"
      datePublished="2026-07-22"
      dateModified="2026-07-22"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        AniDachi vs Metastream for Anime Watch Parties
      </h1>

      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          Metastream is a flexible live tab-sync tool for casual co-watching.
          AniDachi is built for Crunchyroll anime groups who need async
          watchrooms, episode-scoped progress, and spoiler-safe catch-up — and
          also supports YouTube watchrooms.
        </strong>
      </p>

      <h2 id="tldr" className="text-2xl font-bold text-foreground mt-8 mb-3 scroll-mt-24">
        At a glance
      </h2>
      <p className="text-foreground/80 mb-6">
        <strong>TL;DR:</strong> Choose Metastream for quick live hangs across
        random sites. Choose AniDachi when Crunchyroll is home base and your club
        watches on mixed schedules.
      </p>

      <h2
        id="feature-comparison"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Feature comparison
      </h2>
      <ResponsiveCompareTable
        columns={[
          { id: "anidachi", label: "AniDachi", highlight: true },
          { id: "metastream", label: "Metastream" },
        ]}
        rows={[
          {
            feature: "Crunchyroll in-browser",
            values: { anidachi: "yes", metastream: "yes (tab sync)" },
          },
          {
            feature: "Async catch-up",
            values: { anidachi: "yes", metastream: "no" },
          },
          {
            feature: "Auto anime detection",
            values: { anidachi: "yes", metastream: "no" },
          },
          {
            feature: "Per-user Crunchyroll stream",
            values: { anidachi: "yes", metastream: "yes" },
          },
          {
            feature: "Per-episode spoiler controls",
            values: { anidachi: "yes", metastream: "no" },
          },
          {
            feature: "Multi-site live sync",
            values: { anidachi: "Crunchyroll & YouTube", metastream: "Many sites" },
          },
          {
            feature: "Free tier",
            values: {
              anidachi: PRICING_FREE_TIER_TABLE,
              metastream: "Yes (open source)",
            },
          },
        ]}
      />

      <h2
        id="when-metastream"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When Metastream wins
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-6">
        <li>You want a free, open-source live sync layer for many websites.</li>
        <li>Everyone can watch at the same time every session.</li>
        <li>You do not need anime-specific progress or async pacing.</li>
      </ul>

      <h2
        id="when-anidachi"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When AniDachi wins
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
        <li>Your group lives on Crunchyroll for seasonal simulcasts.</li>
        <li>Members watch on different days and need spoiler-safe rooms.</li>
        <li>You want auto anime detection instead of manual room setup.</li>
      </ul>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Review{" "}
        <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
          AniDachi pricing
        </Link>{" "}
        when you are ready to host. For extension options, see{" "}
        <Link
          href="/guides/crunchyroll-watch-party-chrome-extension"
          className="text-brand-orange hover:underline"
        >
          best Crunchyroll watch party Chrome extensions
        </Link>{" "}
        and compare{" "}
        <Link
          href="/compare/anidachi-vs-teleparty"
          className="text-brand-orange hover:underline"
        >
          AniDachi vs Teleparty
        </Link>
        .
      </p>

      <h2 id="related" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Related
      </h2>
      <ul className="space-y-2 text-brand-orange mb-8">
        <li>
          <Link
            href="/guides/crunchyroll-watch-party-chrome-extension"
            className="hover:underline"
          >
            Best Crunchyroll watch party Chrome extensions
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-teleparty" className="hover:underline">
            AniDachi vs Teleparty
          </Link>
        </li>
        <li>
          <Link href="/watch-crunchyroll-together" className="hover:underline">
            Watch Crunchyroll together
          </Link>
        </li>
        {relatedGuideLinks.map((guide) => (
          <li key={guide.href}>
            <Link href={guide.href} className="hover:underline">
              {guide.label}
            </Link>
          </li>
        ))}
      </ul>
    </SeoPageLayout>
  );
}
