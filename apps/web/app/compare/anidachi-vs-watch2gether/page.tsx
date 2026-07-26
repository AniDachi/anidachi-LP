import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_FREE_TIER_TABLE } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "AniDachi vs Watch2Gether — YouTube & Crunchyroll (2026)",
  description:
    "AniDachi vs Watch2Gether for YouTube watch parties and Crunchyroll anime groups: async watchrooms vs free live browser rooms. Full comparison.",
  alternates: { canonical: "/compare/anidachi-vs-watch2gether" },
  openGraph: {
    title: "AniDachi vs Watch2Gether",
    description:
      "Compare YouTube + Crunchyroll watchrooms with Watch2Gether’s free live rooms.",
    url: "/compare/anidachi-vs-watch2gether",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi vs Watch2Gether",
    description: "YouTube & Crunchyroll watchrooms vs generic watch-together rooms.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Does Watch2Gether work for YouTube?",
    answer:
      "Yes. Watch2Gether is one of the most popular free tools for live YouTube sync: create a room, paste a URL, share the link. It does not offer AniDachi-style async watchrooms.",
  },
  {
    question: "Does AniDachi work for YouTube and Crunchyroll?",
    answer:
      "Yes. AniDachi’s Chrome extension supports full watchrooms on YouTube and Crunchyroll — live sync plus async catch-up. Shorts and embeds are not supported.",
  },
  {
    question: "Do tools like Watch2Gether replace a Crunchyroll subscription?",
    answer:
      "No. To stream Crunchyroll legally, each viewer needs their own Crunchyroll access. AniDachi layers watchrooms and sync on top of each person’s stream instead of re-hosting video.",
  },
  {
    question: "Why would I choose AniDachi over a generic room link?",
    answer:
      "If your group watches YouTube or anime weekly, you usually want repeatable rooms, spoiler hygiene, and optional async catch-up—features AniDachi is designed around.",
  },
];

const headings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "tldr", label: "At a glance", level: 2 },
  { id: "feature-comparison", label: "Feature comparison", level: 2 },
  { id: "when-watch2gether", label: "When Watch2Gether is enough", level: 2 },
  { id: "when-anidachi", label: "When AniDachi wins", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AniDachiVsWatch2GetherPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Compare", url: "/watch-anime-together" },
        { name: "AniDachi vs Watch2Gether", url: "/compare/anidachi-vs-watch2gether" },
      ]}
      title="AniDachi vs Watch2Gether"
      description="Compare YouTube + Crunchyroll watchrooms with Watch2Gether’s free live rooms."
      url="/compare/anidachi-vs-watch2gether"
      datePublished="2026-05-11"
      dateModified="2026-07-25"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        AniDachi vs Watch2Gether for YouTube and Anime
      </h1>
      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          Choose AniDachi for YouTube or Crunchyroll watchrooms with async
          catch-up. Choose Watch2Gether for a free, zero-extension live room when
          everyone can watch at the same time.
        </strong>
      </p>

      <h2 id="tldr" className="text-2xl font-bold text-foreground mt-10 mb-3 scroll-mt-24">
        At a glance
      </h2>
      <p className="text-foreground/80 mb-8">
        <strong>Watch2Gether:</strong> fast browser rooms, great for casual YouTube
        hangs. <strong>AniDachi:</strong> Chrome extension watchrooms on YouTube and
        Crunchyroll with sync, chat, and optional async.
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
          { id: "w2g", label: "Watch2Gether" },
        ]}
        rows={[
          {
            feature: "YouTube support",
            values: { anidachi: "yes", w2g: "yes" },
          },
          {
            feature: "Crunchyroll support",
            values: { anidachi: "yes", w2g: "no" },
          },
          {
            feature: "Async catch-up",
            values: { anidachi: "yes", w2g: "no" },
          },
          {
            feature: "Chrome extension",
            values: { anidachi: "yes", w2g: "no (web)" },
          },
          {
            feature: "Free tier",
            values: {
              anidachi: PRICING_FREE_TIER_TABLE,
              w2g: "Yes (rooms)",
            },
          },
        ]}
      />

      <h2
        id="when-watch2gether"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When Watch2Gether is enough
      </h2>
      <ul className="list-disc pl-6 text-foreground/80 space-y-2 mb-8">
        <li>You want a quick YouTube hang with minimal setup.</li>
        <li>Everyone can watch at the same time and doesn’t need async pacing.</li>
        <li>You don’t need Crunchyroll anime detection or per-person progress.</li>
      </ul>

      <h2
        id="when-anidachi"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When AniDachi wins
      </h2>
      <ul className="list-disc pl-6 text-foreground/80 space-y-2 mb-8">
        <li>You host recurring YouTube or Crunchyroll nights.</li>
        <li>Your group needs spoiler-safe async catch-up.</li>
        <li>You want one extension for both platforms.</li>
      </ul>

      <h2 id="related" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Related
      </h2>
      <ul className="space-y-2 text-brand-orange mb-8">
        <li>
          <Link href="/watch-youtube-together" className="hover:underline">
            YouTube watch party hub
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
          <Link href="/watch-crunchyroll-together" className="hover:underline">
            Watch Crunchyroll Together
          </Link>
        </li>
        <li>
          <Link
            href="/guides/watch2gether-alternatives-for-anime"
            className="hover:underline"
          >
            Watch2Gether alternatives for anime
          </Link>
        </li>
        <li>
          <Link href="/pricing" className="hover:underline">
            See pricing and start checkout
          </Link>
        </li>
      </ul>
    </SeoPageLayout>
  );
}
