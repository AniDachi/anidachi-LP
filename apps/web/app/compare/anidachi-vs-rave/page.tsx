import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideOptions,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideBulletList,
  SeoGuideNote,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
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
  title: "AniDachi vs Rave: Which Is Better for Anime Watch Parties? (2026)",
  description:
    "Compare AniDachi's live Crunchyroll and YouTube rooms with Rave's multi-platform sync. Features, personal history, and pricing for anime watch parties.",
  alternates: { canonical: "/compare/anidachi-vs-rave" },
  openGraph: {
    title: "AniDachi vs Rave — Anime Watch Party Comparison",
    description: "Side-by-side comparison of AniDachi and Rave for Crunchyroll anime groups.",
    url: "/compare/anidachi-vs-rave",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi vs Rave for Anime Watch Parties",
    description: "Live sync, personal history, and Crunchyroll features compared.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "What is Rave watch party?",
    answer:
      "Rave (formerly Wacup) is a multi-platform watch party app and browser extension that syncs playback across streaming services including Crunchyroll. It focuses on live synchronized watching with chat and voice features.",
  },
  {
    question: "Is Rave free compared to AniDachi?",
    answer:
      PRICING_RAVE_COMPARE_FAQ,
  },
  {
    question: "Which is better for anime groups in different time zones?",
    answer:
      "AniDachi and Rave both need everyone online together for live sync. AniDachi focuses on Crunchyroll and YouTube rooms with chat, reactions, and voice/video. Async catch-up is coming soon; for now, choose a start time that works across your time zones.",
  },
  {
    question: "Can I switch from Rave to AniDachi?",
    answer:
      "Yes. Install AniDachi, have everyone open the same Crunchyroll episode locally, and let a Plus, Pro, or trial host create a room. Free friends can join. Use AniDachi's voice/video or keep your existing voice chat.",
  },
  {
    question: "Is AniDachi better than Rave for long-distance couples watching anime?",
    answer:
      "AniDachi suits couples who watch Crunchyroll or YouTube live and want chat, reactions, and voice/video beside the player. Your own Plus/Pro access and recording permission enable personal history. Replayed timestamped reactions and asynchronous watching are coming soon, so current live rooms still require both partners online.",
  },
];

const headings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "tldr", label: "At a glance", level: 2 },
  { id: "feature-comparison", label: "Feature comparison", level: 2 },
  { id: "when-anidachi", label: "When to choose AniDachi", level: 2 },
  { id: "when-rave", label: "When to choose Rave", level: 2 },
  { id: "deep-dive", label: "Deeper look", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AniDachiVsRavePage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["how-to-core", "crunchyroll", "online"],
    limit: 3,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Compare", url: "/watch-crunchyroll-together" },
        { name: "AniDachi vs Rave", url: "/compare/anidachi-vs-rave" },
      ]}
      title="AniDachi vs Rave"
      description="Side-by-side comparison for Crunchyroll anime watch parties."
      url="/compare/anidachi-vs-rave"
      datePublished="2026-06-08"
      dateModified="2026-10-01"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
    >
      <SeoGuideTitle>AniDachi vs Rave: Which Is Better for Anime Watch Parties?</SeoGuideTitle>
      <h2 id="answer" className="scroll-mt-24">
        Short Answer
      </h2>
      <SeoGuideAnswer>

        <strong>
          AniDachi is built for Crunchyroll anime groups who want live
          rooms, reactions, and voice/video — and also supports YouTube
          watchrooms. Rave is a general multi-platform watch
          party tool with live sync and voice chat across many streaming services.
        </strong>
      
      </SeoGuideAnswer>

      <h2
        id="tldr"
        className="text-2xl font-bold text-foreground mt-8 mb-3 scroll-mt-24"
      >
        At a glance
      </h2>
      <p className="text-foreground/80 mb-6">
        <strong>TL;DR:</strong> Choose AniDachi for Crunchyroll-first live
        group watching and personal history. Choose Rave if you need multi-platform
        support and can always watch live together.
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
          { id: "rave", label: "Rave" },
        ]}
        rows={[
          { feature: "Crunchyroll support", values: { anidachi: "yes", rave: "yes" } },
          {
            feature: "Multi-platform (Netflix, Disney+, etc.)",
            values: { anidachi: "Netflix coming soon", rave: "yes" },
          },
          {
            feature: "Asynchronous watching",
            values: { anidachi: "Coming soon", rave: "no" },
          },
          {
            feature: "Auto anime detection",
            values: { anidachi: "yes", rave: "no" },
          },
          {
            feature: "Per-user progress tracking",
            values: { anidachi: "Own Plus/Pro + recording permission", rave: "no" },
          },
          { feature: "Real-time chat", values: { anidachi: "yes", rave: "yes" } },
          {
            feature: "Built-in voice chat",
            values: { anidachi: "yes", rave: "yes" },
          },
          {
            feature: "Free tier",
            values: { anidachi: PRICING_FREE_TIER_TABLE, rave: "Yes (basic)" },
          },
        ]}
      />

      <h2
        id="when-anidachi"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When to choose AniDachi
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-6">
        <li>Your group watches primarily on Crunchyroll.</li>
        <li>You want live chat, reactions, and voice/video beside the episode.</li>
        <li>You want to save your own episode progress with Plus or Pro.</li>
        <li>You value auto anime detection over manual room setup.</li>
      </ul>

      <h2
        id="when-rave"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When to choose Rave
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-6">
        <li>You watch on multiple platforms beyond Crunchyroll.</li>
        <li>Everyone is available to watch at the same time.</li>
        <li>You want built-in voice chat without a separate Discord setup.</li>
        <li>You prefer a free tool with basic live sync.</li>
      </ul>

      <h2
        id="deep-dive"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Deeper look: anime-specific vs general-purpose
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-6">
        Rave&apos;s strength is breadth — one tool for Netflix movie nights and
        Crunchyroll anime sessions alike. AniDachi trades that breadth for depth
        on the anime use case: seasonal simulcasts, long-running shonen marathons,
        and friend groups where someone always watches ahead.
      </p>
      <p className="text-foreground/80 leading-relaxed mb-8">
        If your group only watches live and switches platforms often, Rave is a
        reasonable fit. If Crunchyroll is your primary destination, AniDachi
        keeps live room controls and social features beside your own player.
        For a ranked list of anime-focused options,
        see{" "}
        <Link
          href="/guides/rave-alternatives-for-anime"
          className="text-brand-orange hover:underline"
        >
          Rave alternatives for anime
        </Link>
        .
      </p>

      <h2 id="related" className="scroll-mt-24">
        Related
      </h2>
      <SeoGuideRelated
        links={[
          { href: "/guides/does-rave-work-with-youtube", label: "Does Rave work with YouTube?" },
                    { href: "/guides/rave-alternatives-for-anime", label: "Rave alternatives for anime" },
                    { href: "/best-apps-watch-anime-together-long-distance", label: "Best Apps for Watching Anime Together Long Distance" },
                    { href: "/compare/anidachi-vs-teleparty", label: "AniDachi vs Teleparty" },
                    { href: "/compare/anidachi-vs-watch2gether", label: "AniDachi vs Watch2Gether" },
                    { href: "/guides/crunchyroll-watch-party-chrome-extension", label: "Best Crunchyroll watch party Chrome extensions" },
                    ...relatedGuideLinks.map((g) => ({ href: g.href, label: g.label }))
        ]}
      />
    </SeoPageLayout>
  );
}
