import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "AniDachi vs Scener — Best Scener Alternative for Anime Watch Parties (2026)",
  description:
    "Looking for a Scener alternative for anime? Compare AniDachi's Crunchyroll-first live watchrooms, chat, and personal history with Scener's co-watching approach.",
  alternates: { canonical: "/compare/anidachi-vs-scener" },
  openGraph: {
    title: "AniDachi vs Scener — Scener Alternative for Anime Groups",
    description:
      "Compare AniDachi and Scener for Crunchyroll anime nights: live sync, watchrooms, and personal history.",
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
      "Start with your platform and schedules. AniDachi supports live Crunchyroll and YouTube rooms, so agree on a shared start time, then compare sync, chat, voice/video, and setup. Async catch-up is coming soon and is not available today.",
  },
  {
    question: "Does AniDachi work without Crunchyroll?",
    answer:
      "AniDachi supports Crunchyroll and full YouTube watch pages in desktop Chrome. Each viewer streams on their own provider page and needs their own access to the selected video.",
  },
];

const headings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
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
      dateModified="2026-10-01"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        AniDachi vs Scener for anime watch parties
      </h1>
      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          The easiest way to run anime nights on Crunchyroll is per-user playback: everyone
          streams locally and joins the same room. AniDachi is built around that workflow—
          with live watchrooms, chat, reactions, and voice/video beside the player.
        </strong>
      </p>

      <h2 id="tldr" className="text-2xl font-bold text-foreground mt-10 mb-3 scroll-mt-24">
        At a glance
      </h2>
      <p className="text-foreground/80 mb-8">
        <strong>AniDachi:</strong> Crunchyroll-first live watchrooms with sync, chat, and reactions.{" "}
        <strong>General co-watching tools:</strong> useful for quick hangs across many contexts,
        but often lack anime-specific episode context and async pacing.
      </p>

      <h2 id="decision" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Decision checklist
      </h2>
      <ul className="list-disc pl-6 text-foreground/80 space-y-2 mb-8">
        <li>
          <strong>Platform:</strong> If you watch on Crunchyroll, pick a Crunchyroll-first workflow.
        </li>
        <li>
          <strong>Schedules:</strong> Pick a shared start time that works across time zones.
        </li>
        <li>
          <strong>Long shows:</strong> Your own Plus/Pro access and recording permission let you save personal progress.
        </li>
      </ul>

      <h2
        id="when-anidachi"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        When AniDachi wins
      </h2>
      <ul className="list-disc pl-6 text-foreground/80 space-y-2 mb-8">
        <li>You host weekly anime nights on Crunchyroll.</li>
        <li>You want chat, reactions, and voice/video beside the episode.</li>
        <li>You want to save your own viewing progress with Plus or Pro.</li>
      </ul>

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
