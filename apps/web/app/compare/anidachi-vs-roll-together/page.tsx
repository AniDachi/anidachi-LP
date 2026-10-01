import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "AniDachi vs Roll Together — Crunchyroll Watch Party Extensions Compared (2026)",
  description:
    "AniDachi vs Roll Together for Crunchyroll watch parties: live sync, anime detection, personal history, and which workflow fits a friend group.",
  alternates: { canonical: "/compare/anidachi-vs-roll-together" },
  openGraph: {
    title: "AniDachi vs Roll Together",
    description:
      "Compare Crunchyroll watch party extensions for live sync, group setup, and personal history.",
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
      "AniDachi currently supports live rooms, so a synchronized party needs a shared start time. Your own Plus/Pro access and recording permission let you save personal progress for later viewing. Async catch-up and shared group progress are coming soon.",
  },
  {
    question: "Do all viewers still need Crunchyroll?",
    answer:
      "Yes. Everyone still streams from their own Crunchyroll account. AniDachi adds live watchrooms, sync, chat, reactions, and voice/video on top of personal streams.",
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
      dateModified="2026-10-01"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        AniDachi vs Roll Together for Crunchyroll watch parties
      </h1>
      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          AniDachi combines live Crunchyroll sync with chat, reactions, and voice/video
          beside the player. Plus and Pro also let each subscribed viewer save personal
          history after allowing recording.
        </strong>
      </p>

      <h2 id="tldr" className="text-2xl font-bold text-foreground mt-10 mb-3 scroll-mt-24">
        At a glance
      </h2>
      <p className="text-foreground/80 mb-8">
        <strong>TL;DR:</strong> Compare the live features your group uses each week.
        AniDachi offers Crunchyroll and YouTube rooms, social features beside the
        player, and personal history for subscribed viewers.
      </p>

      <h2 id="choose" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        How to choose
      </h2>
      <ul className="list-disc pl-6 text-foreground/80 space-y-2 mb-8">
        <li>
          <strong>Do schedules align?</strong> AniDachi live sync needs everyone online together.
        </li>
        <li>
          <strong>Do you watch long shows?</strong> Personal history helps subscribed viewers resume their own playback.
        </li>
        <li>
          <strong>Do you care about spoilers?</strong> Agree on an episode boundary before the live chat.
        </li>
      </ul>

      <h2 id="anidachi" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Why people pick AniDachi
      </h2>
      <ul className="list-disc pl-6 text-foreground/80 space-y-2 mb-8">
        <li>Live chat, reactions, and voice/video alongside synchronized playback.</li>
        <li>Auto anime detection for repeatable weekly sessions.</li>
        <li>Personal progress with your own Plus/Pro access and recording permission.</li>
      </ul>

      <h2 id="related" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Related
      </h2>
      <ul className="space-y-2 text-brand-orange mb-8">
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
