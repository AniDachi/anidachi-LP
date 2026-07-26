import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_FREE_TIER_TABLE,
  PRICING_RAVE_COMPARE_YOUTUBE_FAQ,
} from "@/lib/pricing-copy";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Rave Alternatives for YouTube Watch Parties (2026) | AniDachi",
  description:
    "Looking for Rave alternatives for YouTube? Ranked options: AniDachi watchrooms, Teleparty, Watch2Gether — when to pick each for synced YouTube nights.",
  alternates: { canonical: "/guides/rave-alternatives-for-youtube" },
  openGraph: {
    title: "Rave Alternatives for YouTube",
    description:
      "Qualify Rave for YouTube co-watching — then ranked AniDachi, Teleparty, and W2G.",
    url: "/guides/rave-alternatives-for-youtube",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rave Alternatives for YouTube",
    description: "Why YouTube groups switch from generic movie sync tools.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Is Rave good for YouTube watch parties?",
    answer:
      "Rave can sync live sessions across platforms, including YouTube in many setups, but it is a generic movies/TV watch-party product. It lacks AniDachi’s async YouTube watchrooms and Chrome extension overlay built for full watch pages.",
  },
  {
    question: "What is the best Rave alternative for YouTube?",
    answer:
      "AniDachi for extension watchrooms with live sync plus async catch-up. Teleparty for free multi-platform live sync. Watch2Gether for browser-only free rooms without an extension.",
  },
  {
    question: "Is AniDachi free compared to Rave?",
    answer: PRICING_RAVE_COMPARE_YOUTUBE_FAQ,
  },
  {
    question: "Where is the full AniDachi vs Rave comparison?",
    answer:
      "See AniDachi vs Rave for the 1:1 feature matrix. This page ranks YouTube-focused alternatives when you are leaving Rave.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "qualify", label: "Does Rave fit YouTube?", level: 2 },
  { id: "alternatives", label: "Ranked alternatives", level: 2 },
  { id: "table", label: "Quick table", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function RaveAlternativesForYoutubePage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-youtube"],
    excludeHref: "/guides/rave-alternatives-for-youtube",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "YouTube Watch Party", url: "/watch-youtube-together" },
        {
          name: "Rave alternatives for YouTube",
          url: "/guides/rave-alternatives-for-youtube",
        },
      ]}
      title="Rave alternatives for YouTube"
      description="Qualify Rave for YouTube co-watching and ranked alternatives led by AniDachi."
      url="/guides/rave-alternatives-for-youtube"
      datePublished="2026-07-26"
      dateModified="2026-07-26"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Rave Alternatives for YouTube Watch Parties
      </h1>

      <h2 id="answer" className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24">
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          The best Rave alternative for YouTube watch parties is AniDachi — Chrome
          extension watchrooms with live sync and async catch-up.
        </strong>{" "}
        Teleparty and Watch2Gether remain solid free live-only options. For a feature
        matrix vs Rave alone, see{" "}
        <Link href="/compare/anidachi-vs-rave" className="text-brand-orange hover:underline">
          AniDachi vs Rave
        </Link>
        .
      </p>

      <h2 id="qualify" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Does Rave Fit YouTube Nights?
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Rave targets generic movie nights across many sites. That can include YouTube,
        but mixed-schedule groups outgrow live-only sync. AniDachi is built for YouTube
        and Crunchyroll rooms on full watch pages — not Shorts or embeds.
      </p>

      <PrimaryCheckoutCta
        pagePath="/guides/rave-alternatives-for-youtube"
        pageTemplate="guide"
        placement="content_mid"
        className="my-10"
      />

      <h2
        id="alternatives"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Ranked Alternatives
      </h2>
      <ol className="list-decimal pl-6 space-y-3 text-foreground/80 mb-8">
        <li>
          <strong>AniDachi</strong> — YouTube watchrooms, async, Discord-friendly voice
          separation. Start at{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            /pricing
          </Link>
          .
        </li>
        <li>
          <strong>Teleparty</strong> — free live sync on YouTube; no async. See{" "}
          <Link
            href="/guides/does-teleparty-work-with-youtube"
            className="text-brand-orange hover:underline"
          >
            Teleparty + YouTube
          </Link>
          .
        </li>
        <li>
          <strong>Watch2Gether</strong> — browser rooms without an extension.
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
          { id: "rave", label: "Rave" },
        ]}
        rows={[
          {
            feature: "YouTube sync",
            values: {
              anidachi: "yes",
              teleparty: "yes",
              w2g: "yes",
              rave: "partial",
            },
          },
          {
            feature: "Async catch-up",
            values: {
              anidachi: "yes",
              teleparty: "no",
              w2g: "no",
              rave: "partial",
            },
          },
          {
            feature: "Free tier",
            values: {
              anidachi: PRICING_FREE_TIER_TABLE,
              teleparty: "yes",
              w2g: "yes",
              rave: "yes",
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
