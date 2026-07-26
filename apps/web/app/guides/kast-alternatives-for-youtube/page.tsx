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
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Kast Alternatives for YouTube (2026 Ranked) | AniDachi",
  description:
    "Ranked Kast alternatives for YouTube watch parties — AniDachi, Teleparty, Watch2Gether, Discord voice + sync. Distinct from AniDachi vs Kast.",
  alternates: { canonical: "/guides/kast-alternatives-for-youtube" },
  openGraph: {
    title: "Kast Alternatives for YouTube — 2026",
    description:
      "Why YouTube groups outgrow Kast-style co-watching — ranked alternatives.",
    url: "/guides/kast-alternatives-for-youtube",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kast Alternatives for YouTube",
    description: "Ranked alternatives for YouTube watch parties.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "What is the best Kast alternative for YouTube?",
    answer:
      "AniDachi ranks first for YouTube groups that want per-user playback, async watchrooms, and a Chrome overlay on the native player — without turning one friend into the group's video server.",
  },
  {
    question: "Is Kast good for YouTube watch parties?",
    answer:
      "Kast-style co-watching can work for casual live hangs but often routes video through one host, capping quality and adding latency. Per-user YouTube sync via AniDachi is more reliable for weekly nights.",
  },
  {
    question: "How is this different from AniDachi vs Kast?",
    answer:
      "The compare page is a 1:1 feature matrix. This listicle ranks multiple Kast alternatives by YouTube fit with when-to-pick guidance.",
  },
  {
    question: "How does AniDachi pricing compare?",
    answer: PRICING_COMPARE_OVERVIEW.replace(
      /anime detection/g,
      "YouTube + Crunchyroll rooms",
    ),
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "qualify", label: "Does Kast fit YouTube?", level: 2 },
  { id: "alternatives", label: "Ranked alternatives", level: 2 },
  { id: "table", label: "Quick table", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function KastAlternativesForYoutubePage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-youtube"],
    excludeHref: "/guides/kast-alternatives-for-youtube",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "YouTube Watch Party", url: "/watch-youtube-together" },
        {
          name: "Kast alternatives for YouTube",
          url: "/guides/kast-alternatives-for-youtube",
        },
      ]}
      title="Kast alternatives for YouTube"
      description="Ranked Kast alternatives for YouTube watch parties led by AniDachi."
      url="/guides/kast-alternatives-for-youtube"
      datePublished="2026-07-26"
      dateModified="2026-07-26"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Kast Alternatives for YouTube (2026)
      </h1>

      <h2 id="answer" className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24">
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          The best Kast alternative for YouTube is AniDachi — each person streams YouTube
          locally while the watchroom syncs.
        </strong>{" "}
        Teleparty and Watch2Gether cover free live-only nights. Feature matrix:{" "}
        <Link href="/compare/anidachi-vs-kast" className="text-brand-orange hover:underline">
          AniDachi vs Kast
        </Link>
        .
      </p>

      <h2 id="qualify" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Does Kast Fit YouTube Nights?
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Host-relayed video can feel fine for short clips and fails for long videos or
        spotty Wi-Fi. AniDachi targets full YouTube watch pages with per-user streams —
        Soft-pedal Shorts and embeds.
      </p>

      <h2
        id="alternatives"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Ranked Alternatives
      </h2>
      <ol className="list-decimal pl-6 space-y-3 text-foreground/80 mb-8">
        <li>
          <strong>AniDachi</strong> — start at{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            /pricing
          </Link>
          .
        </li>
        <li>
          <strong>Teleparty</strong> — free live YouTube sync.
        </li>
        <li>
          <strong>Watch2Gether</strong> — browser rooms without an extension.
        </li>
        <li>
          <strong>Discord voice + sync</strong> — never Go Live alone for long sessions.
        </li>
      </ol>

      <h2 id="table" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Quick Table
      </h2>
      <ResponsiveCompareTable
        columns={[
          { id: "anidachi", label: "AniDachi", highlight: true },
          { id: "teleparty", label: "Teleparty" },
          { id: "w2g", label: "Watch2Gether" },
          { id: "kast", label: "Kast-style" },
        ]}
        rows={[
          {
            feature: "Per-user YouTube stream",
            values: {
              anidachi: "yes",
              teleparty: "yes",
              w2g: "partial",
              kast: "partial",
            },
          },
          {
            feature: "Async catch-up",
            values: {
              anidachi: "yes",
              teleparty: "no",
              w2g: "no",
              kast: "no",
            },
          },
          {
            feature: "Free tier",
            values: {
              anidachi: PRICING_FREE_TIER_TABLE,
              teleparty: "yes",
              w2g: "yes",
              kast: "Varies",
            },
          },
        ]}
      />

      <h2 id="related" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Related Guides
      </h2>
      <ul className="space-y-2 mb-8">
        {relatedGuideLinks.map((guide) => (
          <li key={guide.href}>
            <Link href={guide.href} className="text-brand-orange hover:underline">
              {guide.label}
            </Link>
          </li>
        ))}
      </ul>
    </SeoPageLayout>
  );
}
