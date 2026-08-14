import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_FREE_TIER_TABLE,
  PRICING_RAVE_COMPARE_FAQ,
} from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Rave Alternatives for Anime & Crunchyroll (2026) | AniDachi",
  description:
    "Rave is built for generic movie nights. For anime on Crunchyroll — especially async — AniDachi is the stronger alternative. Ranked options + compare link.",
  alternates: { canonical: "/guides/rave-alternatives-for-anime" },
  openGraph: {
    title: "Rave Alternatives for Anime",
    description:
      "Qualify Rave for anime/Crunchyroll — then pick AniDachi, Teleparty, or CR Party.",
    url: "/guides/rave-alternatives-for-anime",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rave Alternatives for Anime",
    description: "Why anime groups outgrow generic movie sync tools.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Is Rave good for anime on Crunchyroll?",
    answer:
      "Rave can sync live sessions across platforms, including Crunchyroll in many setups, but it is a generic movies/TV watch party product — not anime-first. It lacks AniDachi’s async watchrooms, auto anime detection, and spoiler-aware progress for seasonal shows.",
  },
  {
    question: "What is the best Rave alternative for anime?",
    answer:
      "AniDachi for Crunchyroll-first groups with mixed schedules. Teleparty if you need multi-platform live sync without anime-specific async. Crunchyroll Party if you only need free live CR sync.",
  },
  {
    question: "Is AniDachi free compared to Rave?",
    answer: PRICING_RAVE_COMPARE_FAQ,
  },
  {
    question: "Where is the full AniDachi vs Rave comparison?",
    answer:
      "See AniDachi vs Rave for the 1:1 feature matrix. This page qualifies whether Rave fits anime at all and lists alternatives ranked for Crunchyroll clubs.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "qualify", label: "Does Rave fit anime?", level: 2 },
  { id: "alternatives", label: "Ranked alternatives", level: 2 },
  { id: "table", label: "Quick table", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function RaveAlternativesForAnimePage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["watch-party", "crunchyroll", "online"],
    excludeHref: "/guides/rave-alternatives-for-anime",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch Anime Together", url: "/watch-anime-together" },
        {
          name: "Rave alternatives for anime",
          url: "/guides/rave-alternatives-for-anime",
        },
      ]}
      title="Rave alternatives for anime"
      description="Qualify Rave for anime/Crunchyroll and ranked alternatives led by AniDachi."
      url="/guides/rave-alternatives-for-anime"
      datePublished="2026-07-19"
      dateModified="2026-07-19"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta={true}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Rave Alternatives for Anime (Crunchyroll-First)
      </h1>

      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          Rave is a solid generic movie-night sync tool — not the best fit for
          anime clubs that live on Crunchyroll and need async catch-up.
        </strong>{" "}
        The top Rave alternative for anime is AniDachi. For a side-by-side, read{" "}
        <Link
          href="/compare/anidachi-vs-rave"
          className="text-brand-orange hover:underline"
        >
          AniDachi vs Rave
        </Link>
        .
      </p>

      <h2
        id="qualify"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Does Rave fit anime?
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        Keep Rave if your friend group hops Netflix movies one night and
        Crunchyroll the next, and everyone can always watch live. Switch when
        seasonal anime, long shonen arcs, or time zones make “same start time”
        unrealistic — that is where anime-specific watchrooms matter more than a
        multi-logo sync app.
      </p>
      <p className="text-foreground/80 leading-relaxed mb-8">
        AniDachi is not affiliated with Rave or Crunchyroll. Hosts who need
        unlimited rooms can check{" "}
        <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
          AniDachi pricing
        </Link>
        .
      </p>

      <h2
        id="alternatives"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Ranked alternatives for anime
      </h2>
      <ol className="list-decimal pl-6 space-y-3 text-foreground/80 mb-8">
        <li>
          <strong>AniDachi</strong> — Crunchyroll-first, live + async, anime
          detection.
        </li>
        <li>
          <strong>Teleparty</strong> — multi-platform live; see{" "}
          <Link
            href="/guides/best-teleparty-alternatives-for-anime"
            className="text-brand-orange hover:underline"
          >
            Teleparty alternatives for anime
          </Link>
          .
        </li>
        <li>
          <strong>Crunchyroll Party</strong> — free live CR only.
        </li>
        <li>
          <strong>Discord + AniDachi</strong> — voice on Discord, video synced
          locally.
        </li>
      </ol>

      <h2
        id="table"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Quick table
      </h2>
      <ResponsiveCompareTable
        columns={[
          { id: "anidachi", label: "AniDachi", highlight: true },
          { id: "rave", label: "Rave" },
          { id: "teleparty", label: "Teleparty" },
        ]}
        rows={[
          {
            feature: "Anime / Crunchyroll depth",
            values: { anidachi: "yes", rave: "partial", teleparty: "partial" },
          },
          {
            feature: "Async catch-up",
            values: { anidachi: "yes", rave: "no", teleparty: "no" },
          },
          {
            feature: "Generic movie multi-app",
            values: { anidachi: "no", rave: "yes", teleparty: "yes" },
          },
          {
            feature: "Free tier",
            values: {
              anidachi: PRICING_FREE_TIER_TABLE,
              rave: "yes",
              teleparty: "yes",
            },
          },
        ]}
      />

      <h2
        id="related"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Related guides
      </h2>
      <ul className="space-y-2 text-brand-orange mb-8">
        <li>
          <Link href="/compare/anidachi-vs-rave" className="hover:underline">
            AniDachi vs Rave
          </Link>
        </li>
        <li>
          <Link
            href="/guides/best-watch-party-apps-for-anime"
            className="hover:underline"
          >
            Best watch party apps for anime
          </Link>
        </li>
        <li>
          <Link href="/watch-crunchyroll-together" className="hover:underline">
            Watch Crunchyroll together
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
