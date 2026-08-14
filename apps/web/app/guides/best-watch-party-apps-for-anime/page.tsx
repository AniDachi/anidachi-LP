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
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Best Watch Party Apps for Anime (2026 Ranked) | AniDachi",
  description:
    "Ranked watch party apps for anime: AniDachi, Teleparty, Crunchyroll Party, Discord, Rave — with a comparison table and when to pick each. Deeper than a thin app landing page.",
  alternates: { canonical: "/guides/best-watch-party-apps-for-anime" },
  openGraph: {
    title: "Best Watch Party Apps for Anime — 2026",
    description:
      "Serious ranked comparison for Crunchyroll anime nights — not a thin pseo app blurb.",
    url: "/guides/best-watch-party-apps-for-anime",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Best Watch Party Apps for Anime",
    description: "AniDachi, Teleparty, CR Party, Discord, Rave — ranked.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "What is the best watch party app for anime?",
    answer:
      "AniDachi ranks first for Crunchyroll-first anime groups that need live sync plus async catch-up. Teleparty and Rave are stronger if you jump across many streaming services live. Discord is best as voice, not as the video pipe.",
  },
  {
    question: "Is this different from the anime watch party app page?",
    answer:
      "Yes. The shorter anime watch party app page explains what an app should do. This guide ranks specific products with a comparison table and pick-conditions so you can choose among AniDachi, Teleparty, Crunchyroll Party, Discord, and Rave.",
  },
  {
    question: "Which apps support Crunchyroll?",
    answer:
      "AniDachi, Teleparty, Crunchyroll Party, and Rave can participate in Crunchyroll co-watching workflows (with different depth). Discord only via screen share, which we do not recommend for full episodes.",
  },
  {
    question: "How does AniDachi pricing compare?",
    answer: PRICING_COMPARE_OVERVIEW,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "ranked", label: "Ranked apps", level: 2 },
  { id: "table", label: "Comparison table", level: 2 },
  { id: "picks", label: "When to pick each", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function BestWatchPartyAppsForAnimePage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["watch-party", "crunchyroll", "compare"],
    excludeHref: "/guides/best-watch-party-apps-for-anime",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch Anime Together", url: "/watch-anime-together" },
        {
          name: "Best watch party apps for anime",
          url: "/guides/best-watch-party-apps-for-anime",
        },
      ]}
      title="Best watch party apps for anime"
      description="Ranked comparison of AniDachi, Teleparty, Crunchyroll Party, Discord, and Rave for anime nights."
      url="/guides/best-watch-party-apps-for-anime"
      datePublished="2026-07-19"
      dateModified="2026-07-19"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta={true}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Best Watch Party Apps for Anime (2026)
      </h1>

      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          AniDachi is the best watch party app for most Crunchyroll anime groups —
          especially when async catch-up matters.
        </strong>{" "}
        Teleparty and Rave win on multi-platform live breadth. Crunchyroll Party
        is the free live-only CR option. Discord stays for voice. This ranked
        table goes deeper than the thinner{" "}
        <Link
          href="/guides/anime-watch-party-app"
          className="text-brand-orange hover:underline"
        >
          anime watch party app
        </Link>{" "}
        overview.
      </p>

      <h2
        id="ranked"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Ranked apps
      </h2>
      <ol className="list-decimal pl-6 space-y-3 text-foreground/80 mb-8">
        <li>
          <strong>AniDachi</strong> — Crunchyroll-first watchrooms, anime
          detection, live + async. See{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            pricing
          </Link>
          .
        </li>
        <li>
          <strong>Teleparty</strong> — Multi-service live sync; no async. Details:{" "}
          <Link
            href="/guides/does-teleparty-work-with-crunchyroll"
            className="text-brand-orange hover:underline"
          >
            Does Teleparty work with Crunchyroll?
          </Link>
        </li>
        <li>
          <strong>Crunchyroll Party</strong> — Free CR live sync; upgrade path in{" "}
          <Link
            href="/guides/crunchyroll-party-alternative"
            className="text-brand-orange hover:underline"
          >
            Crunchyroll Party alternative
          </Link>
          .
        </li>
        <li>
          <strong>Discord</strong> — Best voice; weak video via Go Live.
        </li>
        <li>
          <strong>Rave</strong> — Generic movies/multi-platform live; see{" "}
          <Link
            href="/guides/rave-alternatives-for-anime"
            className="text-brand-orange hover:underline"
          >
            Rave alternatives for anime
          </Link>
          .
        </li>
      </ol>

      <h2
        id="table"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Comparison table
      </h2>
      <ResponsiveCompareTable
        columns={[
          { id: "anidachi", label: "AniDachi", highlight: true },
          { id: "teleparty", label: "Teleparty" },
          { id: "crparty", label: "CR Party" },
          { id: "discord", label: "Discord" },
          { id: "rave", label: "Rave" },
        ]}
        rows={[
          {
            feature: "Crunchyroll-first depth",
            values: {
              anidachi: "yes",
              teleparty: "partial",
              crparty: "partial",
              discord: "no",
              rave: "partial",
            },
          },
          {
            feature: "Async catch-up",
            values: {
              anidachi: "yes",
              teleparty: "no",
              crparty: "no",
              discord: "no",
              rave: "no",
            },
          },
          {
            feature: "Multi-platform live",
            values: {
              anidachi: "no",
              teleparty: "yes",
              crparty: "no",
              discord: "partial",
              rave: "yes",
            },
          },
          {
            feature: "Built-in voice",
            values: {
              anidachi: "no",
              teleparty: "Premium",
              crparty: "no",
              discord: "yes",
              rave: "yes",
            },
          },
          {
            feature: "Free tier",
            values: {
              anidachi: PRICING_FREE_TIER_TABLE,
              teleparty: "yes",
              crparty: "yes",
              discord: "yes",
              rave: "yes",
            },
          },
        ]}
      />

      <h2
        id="picks"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When to pick each
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
        <li>
          <strong>AniDachi</strong> — Crunchyroll home base + mixed schedules.
        </li>
        <li>
          <strong>Teleparty / Rave</strong> — live multi-app hopping.
        </li>
        <li>
          <strong>Crunchyroll Party</strong> — free live CR test nights.
        </li>
        <li>
          <strong>Discord</strong> — voice only; pair with AniDachi for video.
        </li>
      </ul>

      <h2
        id="related"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Related guides
      </h2>
      <ul className="space-y-2 text-brand-orange mb-8">
        <li>
          <Link href="/guides/anime-watch-party-app" className="hover:underline">
            Anime watch party app (overview)
          </Link>
        </li>
        <li>
          <Link
            href="/guides/best-teleparty-alternatives-for-anime"
            className="hover:underline"
          >
            Best Teleparty alternatives for anime
          </Link>
        </li>
        <li>
          <Link href="/anime-watch-party-toolkit" className="hover:underline">
            Anime watch party toolkit
          </Link>
        </li>
        <li>
          <Link href="/pricing" className="hover:underline">
            AniDachi pricing
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
