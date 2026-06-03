import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "AniDachi vs Syncplay — Crunchyroll Anime Watch Parties Compared",
  description:
    "AniDachi vs Syncplay: browser-based Crunchyroll watchrooms vs desktop sync for local files. See which fits your friend group.",
  alternates: { canonical: "/compare/anidachi-vs-syncplay" },
  openGraph: {
    title: "AniDachi vs Syncplay",
    description:
      "Compare synced watching for Crunchyroll tabs vs Syncplay-style desktop workflows.",
    url: "/compare/anidachi-vs-syncplay",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi vs Syncplay",
    description: "Crunchyroll-first watchrooms vs desktop sync workflows.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Can Syncplay sync Crunchyroll in a browser tab?",
    answer:
      "Syncplay is generally used for desktop playback workflows (often local files) rather than syncing Crunchyroll tabs with per-user accounts. If your group watches on Crunchyroll, a browser-first tool like AniDachi is usually a better fit.",
  },
  {
    question: "Is AniDachi only for Crunchyroll?",
    answer:
      "Yes. AniDachi is Crunchyroll-first. That focus enables anime detection, watchroom workflows, and progress tracking built around Crunchyroll viewing.",
  },
];

const headings: TocHeading[] = [
  { id: "tldr", label: "At a glance", level: 2 },
  { id: "what-youre-syncing", label: "What you are syncing", level: 2 },
  { id: "when-syncplay", label: "When Syncplay makes sense", level: 2 },
  { id: "when-anidachi", label: "When AniDachi makes sense", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AniDachiVsSyncplayPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Compare", url: "/watch-crunchyroll-together" },
        { name: "AniDachi vs Syncplay", url: "/compare/anidachi-vs-syncplay" },
      ]}
      title="AniDachi vs Syncplay"
      description="Compare Crunchyroll-first watchrooms with desktop sync workflows."
      url="/compare/anidachi-vs-syncplay"
      datePublished="2026-05-11"
      dateModified="2026-05-11"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-gray-900 mb-6">
        AniDachi vs Syncplay for anime watch parties
      </h1>

      <p className="text-xl text-gray-700 leading-relaxed mb-8">
        <strong>
          The real decision is what you are trying to sync. If your group watches anime
          on Crunchyroll, the simplest path is: everyone streams locally, and a browser
          tool keeps rooms and timing aligned. If your group syncs desktop playback,
          you might prefer a desktop-first workflow.
        </strong>
      </p>

      <h2 id="tldr" className="text-2xl font-bold text-gray-900 mt-10 mb-3 scroll-mt-24">
        At a glance
      </h2>
      <p className="text-gray-700 mb-8">
        <strong>AniDachi:</strong> Crunchyroll-first watchrooms, sync, chat, and optional
        async catch-up. <strong>Syncplay:</strong> desktop sync style workflows (often for
        local playback) that don’t map cleanly onto per-user Crunchyroll accounts.
      </p>

      <h2
        id="what-youre-syncing"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        What you are syncing
      </h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-8">
        <li>
          <strong>Crunchyroll group watching:</strong> everyone streams through their own
          Crunchyroll login; the tool syncs playback state and adds a room layer.
        </li>
        <li>
          <strong>Desktop playback workflows:</strong> everyone plays media locally; the tool
          keeps the players aligned.
        </li>
      </ul>

      <h2
        id="when-syncplay"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        When Syncplay makes sense
      </h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-8">
        <li>You are syncing desktop playback rather than streaming in a web tab.</li>
        <li>Your group has a consistent “everyone start now” live schedule.</li>
        <li>You don’t need Crunchyroll-specific detection or per-episode progress tracking.</li>
      </ul>

      <h2
        id="when-anidachi"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        When AniDachi makes sense
      </h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-8">
        <li>Your anime nights happen on Crunchyroll.</li>
        <li>You want a persistent watchroom for a show (not a one-off link).</li>
        <li>Your group needs async catch-up without losing episode context.</li>
      </ul>

      <h2 id="related" className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24">
        Related
      </h2>
      <ul className="space-y-2 text-purple-600 mb-8">
        <li>
          <Link href="/watch-crunchyroll-together" className="hover:underline">
            Watch Crunchyroll Together — complete guide
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-discord-screen-share" className="hover:underline">
            AniDachi vs Discord screen share
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

