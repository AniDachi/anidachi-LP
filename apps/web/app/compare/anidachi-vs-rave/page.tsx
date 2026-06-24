import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "AniDachi vs Rave: Which Is Better for Anime Watch Parties? (2026)",
  description:
    "AniDachi is better for async Crunchyroll groups and long-distance couples. Rave is better for live multi-platform sync. Full feature comparison and pricing for anime watch parties.",
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
    description: "Async, sync, and Crunchyroll features compared.",
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
      "Rave offers a free tier with basic sync and chat. AniDachi is a paid product during early access ($8/mo) focused on Crunchyroll-first features like async watchrooms, auto anime detection, and per-person progress tracking.",
  },
  {
    question: "Which is better for anime groups in different time zones?",
    answer:
      "AniDachi is built for async co-watching — members catch up on their own schedule without losing the shared watchroom or spoiler boundaries. Rave is primarily designed for live sync when everyone watches at the same time.",
  },
  {
    question: "Can I switch from Rave to AniDachi?",
    answer:
      "Yes. Install AniDachi, have everyone open the same Crunchyroll episode locally, and create a new watchroom. Your group keeps the same Discord voice chat or messaging — only the sync layer changes.",
  },
  {
    question: "Is AniDachi better than Rave for long-distance couples watching anime?",
    answer:
      "Yes — AniDachi's async mode is specifically designed for different schedules and time zones. Each person watches when available, marks episodes done, and leaves timestamped reactions. The other person reads them after finishing the same episode. Rave requires both people online simultaneously.",
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
      dateModified="2026-06-23"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        AniDachi vs Rave: Which Is Better for Anime Watch Parties?
      </h1>
      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          AniDachi is purpose-built for Crunchyroll anime groups who need async
          watchrooms and progress tracking. Rave is a general multi-platform watch
          party tool with live sync and voice chat across many streaming services.
        </strong>
      </p>

      <h2
        id="tldr"
        className="text-2xl font-bold text-foreground mt-8 mb-3 scroll-mt-24"
      >
        At a glance
      </h2>
      <p className="text-foreground/80 mb-6">
        <strong>TL;DR:</strong> Choose AniDachi for Crunchyroll-first, async-friendly
        group watching with spoiler controls. Choose Rave if you need multi-platform
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
            values: { anidachi: "No (Crunchyroll only)", rave: "yes" },
          },
          {
            feature: "Asynchronous watching",
            values: { anidachi: "yes", rave: "no" },
          },
          {
            feature: "Auto anime detection",
            values: { anidachi: "yes", rave: "no" },
          },
          {
            feature: "Per-user progress tracking",
            values: { anidachi: "yes", rave: "no" },
          },
          { feature: "Real-time chat", values: { anidachi: "yes", rave: "yes" } },
          {
            feature: "Built-in voice chat",
            values: { anidachi: "no", rave: "yes" },
          },
          {
            feature: "Free tier",
            values: { anidachi: "No ($8/mo)", rave: "Yes (basic)" },
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
        <li>You need async watching — different schedules or time zones.</li>
        <li>You want individual episode progress and spoiler boundaries.</li>
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
        reasonable fit. If Crunchyroll is your primary destination and schedules
        never align perfectly, AniDachi&apos;s async watchrooms solve the problem
        Rave wasn&apos;t designed for.
      </p>

      <h2
        id="related"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Related
      </h2>
      <ul className="space-y-2 text-brand-orange">
        <li>
          <Link href="/best-apps-watch-anime-together-long-distance" className="hover:underline">
            Best Apps for Watching Anime Together Long Distance
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-teleparty" className="hover:underline">
            AniDachi vs Teleparty
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-watch2gether" className="hover:underline">
            AniDachi vs Watch2Gether
          </Link>
        </li>
        <li>
          <Link href="/guides/crunchyroll-watch-party-chrome-extension" className="hover:underline">
            Best Crunchyroll watch party Chrome extensions
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
