import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "AniDachi vs Scener — Best Scener Alternative for Anime Watch Parties (2026)",
  description:
    "Looking for a Scener alternative for anime? AniDachi vs Scener compared: Crunchyroll-first watchrooms with async catch-up vs Scener's general co-watching approach. Which is better for anime?",
  alternates: { canonical: "/compare/anidachi-vs-scener" },
  openGraph: {
    title: "AniDachi vs Scener — Scener Alternative for Anime Groups",
    description:
      "Best Scener alternative for Crunchyroll anime nights. AniDachi vs Scener: async, sync, and watchroom comparison.",
    url: "/compare/anidachi-vs-scener",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi vs Scener — Scener Alternative for Anime",
    description: "Scener alternative for Crunchyroll anime: AniDachi vs Scener compared.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "What should I compare first when picking a co-watching tool?",
    answer:
      "Start with your platform and schedules. If you’re Crunchyroll-first and not everyone can watch live, prioritize watchrooms with episode context and async-friendly progress—then look at sync quality and setup friction.",
  },
  {
    question: "Does AniDachi work without Crunchyroll?",
    answer:
      "AniDachi is built for Crunchyroll. Each viewer still streams from their own Crunchyroll account; AniDachi adds the room layer on top.",
  },
];

const headings: TocHeading[] = [
  { id: "tldr", label: "At a glance", level: 2 },
  { id: "decision", label: "Decision checklist", level: 2 },
  { id: "when-anidachi", label: "When AniDachi wins", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AniDachiVsScenerPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Compare", url: "/watch-crunchyroll-together" },
        { name: "AniDachi vs Scener", url: "/compare/anidachi-vs-scener" },
      ]}
      title="AniDachi vs Scener"
      description="Compare Crunchyroll-first watchrooms with general co-watching workflows."
      url="/compare/anidachi-vs-scener"
      datePublished="2026-05-11"
      dateModified="2026-05-11"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-gray-900 mb-6">
        AniDachi vs Scener for anime watch parties
      </h1>

      <p className="text-xl text-gray-700 leading-relaxed mb-8">
        <strong>
          The easiest way to run anime nights on Crunchyroll is per-user playback: everyone
          streams locally and joins the same room. AniDachi is built around that workflow—
          with watchrooms, sync, and optional async catch-up when life gets busy.
        </strong>
      </p>

      <h2 id="tldr" className="text-2xl font-bold text-gray-900 mt-10 mb-3 scroll-mt-24">
        At a glance
      </h2>
      <p className="text-gray-700 mb-8">
        <strong>AniDachi:</strong> Crunchyroll-first watchrooms (sync, chat, progress, async).{" "}
        <strong>General co-watching tools:</strong> useful for quick hangs across many contexts,
        but often lack anime-specific episode context and async pacing.
      </p>

      <h2 id="decision" className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24">
        Decision checklist
      </h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-8">
        <li>
          <strong>Platform:</strong> If you watch on Crunchyroll, pick a Crunchyroll-first workflow.
        </li>
        <li>
          <strong>Schedules:</strong> If time zones are real, you want async-friendly rooms.
        </li>
        <li>
          <strong>Long shows:</strong> Progress tracking keeps the group from drifting.
        </li>
      </ul>

      <h2
        id="when-anidachi"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        When AniDachi wins
      </h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-8">
        <li>You host weekly anime nights on Crunchyroll.</li>
        <li>You want one persistent room per series.</li>
        <li>You need async catch-up without spoilers.</li>
      </ul>

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
          <Link href="/compare/anidachi-vs-teleparty" className="hover:underline">
            AniDachi vs Teleparty
          </Link>
        </li>
        <li>
          <Link href="/#pricing" className="hover:underline">
            See pricing and start checkout
          </Link>
        </li>
      </ul>
    </SeoPageLayout>
  );
}

