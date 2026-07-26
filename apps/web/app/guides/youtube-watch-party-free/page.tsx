import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_FREE_TIER_TABLE,
  PRICING_IS_ANIDACHI_FREE_ANSWER,
  PRICING_PLUS_SHORT,
} from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "YouTube Watch Party Free Options (2026) | AniDachi",
  description:
    "Free YouTube watch party options: AniDachi Free tier, Teleparty, Watch2Gether. What “free” includes — and when hosts upgrade.",
  alternates: { canonical: "/guides/youtube-watch-party-free" },
  openGraph: {
    title: "YouTube Watch Party Free Options",
    description:
      "Compare free YouTube watch party tools and AniDachi’s Free hosting limits.",
    url: "/guides/youtube-watch-party-free",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "YouTube Watch Party Free",
    description: "Free tiers for YouTube sync — what you get and tradeoffs.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Is there a free YouTube watch party?",
    answer:
      "Yes. Teleparty and Watch2Gether offer free live sync. AniDachi has a Free tier for joining and limited hosting — see pricing for Plus when you host weekly nights.",
  },
  {
    question: "Is AniDachi free for YouTube watch parties?",
    answer: PRICING_IS_ANIDACHI_FREE_ANSWER,
  },
  {
    question: "What is the best free YouTube watch party app?",
    answer:
      "For free live-only nights, Teleparty or Watch2Gether. For free joining plus a path to async catch-up when the host upgrades, AniDachi. See best apps to watch YouTube together for a fuller list.",
  },
  {
    question: "Does YouTube itself offer a free watch party?",
    answer:
      "YouTube has no native watch party. Free third-party tools fill that gap on full watch pages.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "options", label: "Free options", level: 2 },
  { id: "limits", label: "What free usually means", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function YoutubeWatchPartyFreePage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-youtube"],
    excludeHref: "/guides/youtube-watch-party-free",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "YouTube Watch Party", url: "/watch-youtube-together" },
        {
          name: "YouTube watch party free",
          url: "/guides/youtube-watch-party-free",
        },
      ]}
      title="YouTube watch party free options"
      description="Free YouTube watch party tools and AniDachi Free tier limits."
      url="/guides/youtube-watch-party-free"
      datePublished="2026-07-26"
      dateModified="2026-07-26"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        YouTube Watch Party Free Options (2026)
      </h1>

      <h2 id="answer" className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24">
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          Yes — you can run a free YouTube watch party with Teleparty, Watch2Gether, or
          AniDachi&apos;s Free tier ({PRICING_FREE_TIER_TABLE.toLowerCase()}).
        </strong>{" "}
        Free usually means live-only sync and host limits. Upgrade the host to Plus (
        {PRICING_PLUS_SHORT}) when you need unlimited hosting and async catch-up — see{" "}
        <Link href="/pricing" className="text-brand-orange hover:underline">
          /pricing
        </Link>
        .
      </p>

      <h2 id="options" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Free Options Compared
      </h2>
      <ul className="space-y-3 text-foreground/80 mb-8">
        <li>
          <strong>AniDachi Free:</strong> Join rooms and host limited daily time; guests
          stay Free when the host upgrades.
        </li>
        <li>
          <strong>Teleparty:</strong> Free live YouTube sync — confirm support in{" "}
          <Link
            href="/guides/does-teleparty-work-with-youtube"
            className="text-brand-orange hover:underline"
          >
            Does Teleparty work with YouTube?
          </Link>
          .
        </li>
        <li>
          <strong>Watch2Gether:</strong> Free browser rooms without an extension.
        </li>
      </ul>

      <h2 id="limits" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        What “Free” Usually Means
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Expect live-only sessions, smaller rooms, or daily host caps. Async catch-up,
        larger clubs, and longer history typically sit on paid host plans. YouTube itself
        remains free for most public videos — the sync layer is what may charge.
      </p>

      <h2 id="related" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Related Guides
      </h2>
      <ul className="space-y-2 mb-8">
        <li>
          <Link
            href="/guides/best-apps-to-watch-youtube-together"
            className="text-brand-orange hover:underline"
          >
            Best apps to watch YouTube together
          </Link>
        </li>
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
