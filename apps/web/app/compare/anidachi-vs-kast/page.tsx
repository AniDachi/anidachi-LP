import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "AniDachi vs Kast — Best Kast Alternative for Crunchyroll Anime (2026)",
  description:
    "AniDachi is the best Kast alternative for anime on Crunchyroll — per-user playback, async watchrooms, and auto anime detection. Kast vs AniDachi compared.",
  alternates: { canonical: "/compare/anidachi-vs-kast" },
  openGraph: {
    title: "AniDachi vs Kast — Kast Alternative for Anime Groups",
    description:
      "Compare AniDachi's Crunchyroll-first watchrooms with Kast for anime nights. Best Kast alternative for anime watch parties.",
    url: "/compare/anidachi-vs-kast",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi vs Kast — Best Kast Alternative for Anime",
    description: "Kast alternative for Crunchyroll anime nights: AniDachi vs Kast compared.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "What’s the biggest difference for Crunchyroll groups?",
    answer:
      "AniDachi is built around per-user Crunchyroll tabs with a watchroom layer on top (sync, chat, progress). General co-watching setups often try to make one stream work for everyone, which can turn one person’s device and connection into the bottleneck.",
  },
  {
    question: "Can AniDachi work alongside Discord?",
    answer:
      "Yes. Many groups keep Discord for voice and use AniDachi for synced Crunchyroll playback and episode-scoped watchroom context.",
  },
];

const headings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "tldr", label: "At a glance", level: 2 },
  { id: "reliability", label: "Reliability and quality", level: 2 },
  { id: "workflow", label: "Workflow for weekly anime nights", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AniDachiVsKastPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Compare", url: "/watch-crunchyroll-together" },
        { name: "AniDachi vs Kast", url: "/compare/anidachi-vs-kast" },
      ]}
      title="AniDachi vs Kast"
      description="Compare Crunchyroll-first watchrooms with general-purpose co-watching."
      url="/compare/anidachi-vs-kast"
      datePublished="2026-05-11"
      dateModified="2026-06-23"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        AniDachi vs Kast for anime watch parties
      </h1>
      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          If your group watches on Crunchyroll, the highest-quality setup is usually “everyone
          streams locally.” AniDachi adds the watchroom and sync layer without turning one friend’s
          computer into the group’s video server.
        </strong>
      </p>

      <h2 id="tldr" className="text-2xl font-bold text-foreground mt-10 mb-3 scroll-mt-24">
        At a glance
      </h2>
      <p className="text-foreground/80 mb-8">
        <strong>AniDachi:</strong> Crunchyroll-first watchrooms, sync, chat, and optional async
        catch-up. <strong>Kast-style workflows:</strong> generic co-watching setups that can work
        well for casual hangs, but may add complexity for per-user streaming subscriptions.
      </p>

      <h2 id="reliability" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Reliability and quality
      </h2>
      <ul className="list-disc pl-6 text-foreground/80 space-y-2 mb-8">
        <li>Per-user playback keeps bitrate high for everyone.</li>
        <li>Sync tools work best when each viewer’s stream is independent.</li>
        <li>Watchrooms add structure (episode context, spoiler hygiene) that chat apps alone lack.</li>
      </ul>

      <h2 id="workflow" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Workflow for weekly anime nights
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Start with{" "}
        <Link href="/watch-crunchyroll-together" className="text-brand-orange hover:underline">
          the Crunchyroll watch-together guide
        </Link>
        . If you want async catch-up and progress tracking for long-running shows, review{" "}
        <Link href="/#pricing" className="text-brand-orange font-medium hover:underline">
          pricing on the homepage
        </Link>
        .
      </p>

      <h2 id="related" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Related
      </h2>
      <ul className="space-y-2 text-brand-orange mb-8">
        <li>
          <Link href="/compare/anidachi-vs-discord-screen-share" className="hover:underline">
            AniDachi vs Discord screen share
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-watch2gether" className="hover:underline">
            AniDachi vs Watch2Gether
          </Link>
        </li>
      </ul>
    </SeoPageLayout>
  );
}

