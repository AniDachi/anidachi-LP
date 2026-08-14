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
  title: "AniDachi vs Hyperbeam — Best Hyperbeam Alternative for Anime (2026)",
  description:
    "AniDachi vs Hyperbeam for anime watch parties: per-user Crunchyroll sync vs cloud browser tab streaming. When to pick each for group nights.",
  alternates: { canonical: "/compare/anidachi-vs-hyperbeam" },
  openGraph: {
    title: "AniDachi vs Hyperbeam for Anime Watch Parties",
    description:
      "Tab streaming vs per-user Crunchyroll sync — full comparison for anime groups.",
    url: "/compare/anidachi-vs-hyperbeam",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi vs Hyperbeam — Anime Comparison",
    description: "Hyperbeam alternative for Crunchyroll anime nights.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Is Hyperbeam good for watching Crunchyroll anime together?",
    answer:
      "Hyperbeam streams a shared browser tab in the cloud — one person drives, others watch the relay. It works for casual hangs but adds latency, caps quality, and does not give each viewer their own Crunchyroll player controls or async catch-up.",
  },
  {
    question: "What is the best Hyperbeam alternative for anime?",
    answer:
      "AniDachi is the best Hyperbeam alternative for Crunchyroll anime groups: each person streams locally at full quality while the watchroom syncs playback and tracks episode progress.",
  },
  {
    question: "Does Hyperbeam replace individual Crunchyroll subscriptions?",
    answer:
      "No. Even with Hyperbeam, the host still needs Crunchyroll access in the shared tab. Other viewers are passive unless they also log in separately — account sharing in one cloud browser violates terms and creates a single-stream bottleneck.",
  },
  {
    question: "How does AniDachi pricing compare to Hyperbeam?",
    answer: PRICING_COMPARE_OVERVIEW,
  },
];

const headings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "tldr", label: "At a glance", level: 2 },
  { id: "feature-comparison", label: "Feature comparison", level: 2 },
  { id: "when-hyperbeam", label: "When Hyperbeam wins", level: 2 },
  { id: "when-anidachi", label: "When AniDachi wins", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AniDachiVsHyperbeamPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["discord", "how-to-core", "online"],
    limit: 3,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Compare", url: "/watch-crunchyroll-together" },
        { name: "AniDachi vs Hyperbeam", url: "/compare/anidachi-vs-hyperbeam" },
      ]}
      title="AniDachi vs Hyperbeam"
      description="Cloud tab streaming vs per-user Crunchyroll watchrooms."
      url="/compare/anidachi-vs-hyperbeam"
      datePublished="2026-07-22"
      dateModified="2026-07-22"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        AniDachi vs Hyperbeam for Anime Watch Parties
      </h1>

      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          Hyperbeam relays one cloud browser tab to the group — fine for quick
          demos, weak for weekly Crunchyroll anime nights. AniDachi syncs
          per-user Crunchyroll streams so everyone gets full quality and their
          own player controls.
        </strong>
      </p>

      <h2 id="tldr" className="text-2xl font-bold text-foreground mt-8 mb-3 scroll-mt-24">
        At a glance
      </h2>
      <p className="text-foreground/80 mb-6">
        <strong>TL;DR:</strong> Hyperbeam = one shared tab in the cloud. AniDachi
        = everyone streams Crunchyroll locally with a watchroom sync layer.
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
          { id: "hyperbeam", label: "Hyperbeam" },
        ]}
        rows={[
          {
            feature: "Per-user full-quality stream",
            values: { anidachi: "yes", hyperbeam: "no (relay)" },
          },
          {
            feature: "Crunchyroll in-browser",
            values: { anidachi: "yes", hyperbeam: "yes (shared tab)" },
          },
          {
            feature: "Async catch-up",
            values: { anidachi: "yes", hyperbeam: "no" },
          },
          {
            feature: "Individual pause/seek controls",
            values: { anidachi: "yes", hyperbeam: "Host-driven" },
          },
          {
            feature: "Anime detection",
            values: { anidachi: "yes", hyperbeam: "no" },
          },
          {
            feature: "Latency / quality",
            values: {
              anidachi: "Native CR bitrate",
              hyperbeam: "Cloud relay overhead",
            },
          },
          {
            feature: "Free tier",
            values: {
              anidachi: PRICING_FREE_TIER_TABLE,
              hyperbeam: "Limited free hours",
            },
          },
        ]}
      />

      <h2
        id="when-hyperbeam"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When Hyperbeam wins
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-6">
        <li>You need a one-off shared browser for non-streaming sites.</li>
        <li>Only one person has Crunchyroll access (still not recommended long-term).</li>
        <li>You want zero extension installs for passive viewers.</li>
      </ul>

      <h2
        id="when-anidachi"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When AniDachi wins
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
        <li>Everyone has their own Crunchyroll login and wants native quality.</li>
        <li>Your club watches weekly and needs repeatable watchrooms.</li>
        <li>Schedules drift and async catch-up matters.</li>
      </ul>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Migrating off relay-style setups? Follow{" "}
        <Link
          href="/guides/switch-from-discord-screen-share"
          className="text-brand-orange hover:underline"
        >
          switch from Discord screen share
        </Link>{" "}
        and read{" "}
        <Link
          href="/guides/how-to-watch-anime-together-without-screen-share"
          className="text-brand-orange hover:underline"
        >
          how to watch anime together without screen share
        </Link>
        . See{" "}
        <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
          AniDachi pricing
        </Link>
        .
      </p>

      <h2 id="related" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Related
      </h2>
      <ul className="space-y-2 text-brand-orange mb-8">
        <li>
          <Link
            href="/guides/switch-from-discord-screen-share"
            className="hover:underline"
          >
            Switch from Discord screen share
          </Link>
        </li>
        <li>
          <Link
            href="/guides/how-to-watch-anime-together-without-screen-share"
            className="hover:underline"
          >
            Watch anime without screen share
          </Link>
        </li>
        <li>
          <Link
            href="/compare/anidachi-vs-discord-screen-share"
            className="hover:underline"
          >
            AniDachi vs Discord screen share
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
