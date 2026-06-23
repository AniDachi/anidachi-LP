import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "AniDachi vs Roll Together — Crunchyroll Watch Party Extensions Compared (2026)",
  description:
    "AniDachi vs Roll Together for Crunchyroll watch parties: async vs live-only, anime detection, and which workflow fits a friend group.",
  alternates: { canonical: "/compare/anidachi-vs-roll-together" },
  openGraph: {
    title: "AniDachi vs Roll Together",
    description:
      "Compare Crunchyroll watch party extension workflows: live-only sync vs async watchrooms.",
    url: "/compare/anidachi-vs-roll-together",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi vs Roll Together",
    description: "Which extension fits weekly anime nights on Crunchyroll?",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Which is better for groups that can’t always watch live?",
    answer:
      "If your group regularly watches on different schedules, AniDachi is designed for async catch-up in one shared watchroom while still keeping episode context and spoiler boundaries.",
  },
  {
    question: "Do all viewers still need Crunchyroll?",
    answer:
      "Yes. Everyone still streams from their own Crunchyroll account. AniDachi adds watchrooms, sync, chat, and progress on top of personal streams.",
  },
];

const headings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "tldr", label: "At a glance", level: 2 },
  { id: "choose", label: "How to choose", level: 2 },
  { id: "anidachi", label: "Why people pick AniDachi", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AniDachiVsRollTogetherPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Compare", url: "/watch-crunchyroll-together" },
        {
          name: "AniDachi vs Roll Together",
          url: "/compare/anidachi-vs-roll-together",
        },
      ]}
      title="AniDachi vs Roll Together"
      description="Compare Crunchyroll watch-party extension workflows for real friend groups."
      url="/compare/anidachi-vs-roll-together"
      datePublished="2026-05-11"
      dateModified="2026-06-23"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-gray-900 mb-6">
        AniDachi vs Roll Together for Crunchyroll watch parties
      </h1>
      <h2
        id="answer"
        className="text-2xl font-bold text-gray-900 mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-gray-700 leading-relaxed mb-6">
        <strong>
          Most Crunchyroll watch party extensions solve one problem: live sync. AniDachi
          focuses on the next problem: what happens when one friend is late, in another
          time zone, or bingeing on a different day.
        </strong>
      </p>

      <h2 id="tldr" className="text-2xl font-bold text-gray-900 mt-10 mb-3 scroll-mt-24">
        At a glance
      </h2>
      <p className="text-gray-700 mb-8">
        <strong>TL;DR:</strong> If you always watch live, a live-sync extension can be
        enough. If you want one shared room for a series with async catch-up, spoiler-aware
        episode context, and progress tracking, choose AniDachi.
      </p>

      <h2 id="choose" className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24">
        How to choose
      </h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-8">
        <li>
          <strong>Do schedules align?</strong> If not, async watchrooms beat live-only sync.
        </li>
        <li>
          <strong>Do you watch long shows?</strong> Progress tracking matters more over weeks.
        </li>
        <li>
          <strong>Do you care about spoiler hygiene?</strong> Episode-scoped chat keeps rooms safe.
        </li>
      </ul>

      <h2 id="anidachi" className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24">
        Why people pick AniDachi
      </h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-8">
        <li>Async catch-up in the same room as live viewers.</li>
        <li>Auto anime detection for repeatable weekly sessions.</li>
        <li>Per-person progress for long-running groups.</li>
      </ul>

      <h2 id="related" className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24">
        Related
      </h2>
      <ul className="space-y-2 text-purple-600 mb-8">
        <li>
          <Link href="/guides/crunchyroll-watch-party-chrome-extension" className="hover:underline">
            Best Crunchyroll watch party Chrome extensions
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-crunchyroll-party" className="hover:underline">
            AniDachi vs Crunchyroll Party
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

