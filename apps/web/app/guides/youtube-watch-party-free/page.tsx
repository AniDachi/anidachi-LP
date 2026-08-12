import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideOptions,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideBulletList,
  SeoGuideNote,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_FREE_TIER_TABLE,
  PRICING_IS_ANIDACHI_FREE_YOUTUBE_ANSWER,
  PRICING_PLUS_SHORT,
} from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Free YouTube Watch Party — Free Tier Options (2026) | AniDachi",
  description:
    "Yes, you can run a free YouTube watch party. AniDachi Free for joining + limited hosting; upgrade the host for async. Compare Teleparty and Watch2Gether — start at pricing.",
  alternates: { canonical: "/guides/youtube-watch-party-free" },
  openGraph: {
    title: "Free YouTube Watch Party Options",
    description:
      "AniDachi Free vs Teleparty vs Watch2Gether — what free includes and when hosts upgrade.",
    url: "/guides/youtube-watch-party-free",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free YouTube Watch Party Options",
    description: "Free tiers for YouTube sync — then upgrade the host when you need async.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Is there a free YouTube watch party?",
    answer:
      "Yes. Teleparty and Watch2Gether offer free live sync. AniDachi Free lets friends join and host limited daily rooms — see /pricing when the host needs unlimited rooms or async catch-up.",
  },
  {
    question: "Is AniDachi free for YouTube watch parties?",
    answer: PRICING_IS_ANIDACHI_FREE_YOUTUBE_ANSWER,
  },
  {
    question: "What is the best free YouTube watch party app?",
    answer:
      "For free live-only nights, Teleparty or Watch2Gether. For free joining plus a path to async catch-up when the host upgrades, AniDachi. See best apps to watch YouTube together for a fuller list.",
  },
  {
    question: "Does YouTube itself offer a free watch party?",
    answer:
      "YouTube has no native watch party. Free third-party tools work on full youtube.com/watch pages in desktop Chrome — not Shorts, embeds, or the mobile app.",
  },
  {
    question: "When should the host upgrade from Free?",
    answer: `Upgrade to Plus (${PRICING_PLUS_SHORT}) when you hit the Free daily host cap, need larger rooms, or want async reactions for friends in other time zones. Guests can stay on Free.`,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "options", label: "Free options", level: 2 },
  { id: "limits", label: "What free usually means", level: 2 },
  { id: "upgrade", label: "When hosts upgrade", level: 2 },
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
      title="Free YouTube watch party options"
      description="Free YouTube watch party tools and AniDachi Free tier limits — when hosts upgrade."
      url="/guides/youtube-watch-party-free"
      datePublished="2026-07-26"
      dateModified="2026-08-12"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <SeoGuideTitle>Free YouTube Watch Party Options (2026)</SeoGuideTitle>

      <h2 id="answer" className="scroll-mt-24">
        Short Answer
      </h2>
      <SeoGuideAnswer>

        <strong>
          Yes — you can run a free YouTube watch party with AniDachi Free (
          {PRICING_FREE_TIER_TABLE.toLowerCase()}), Teleparty, or Watch2Gether.
        </strong>{" "}
        Free usually means live-only sync and host caps. When your group needs unlimited
        hosting or async catch-up, the{" "}
        <strong>host</strong> upgrades on{" "}
        <Link href="/pricing">
          /pricing
        </Link>{" "}
        while guests stay Free. Hub:{" "}
        <Link href="/watch-youtube-together">
          YouTube Watch Party
        </Link>
        .
      
      </SeoGuideAnswer>

      <h2 id="options" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Free Options Compared
      </h2>
      <ul className="space-y-3 text-foreground/80 mb-8">
        <li>
          <strong>AniDachi Free:</strong> Join rooms and host limited daily time; unlock
          async + unlimited hosting when the host moves to Plus.
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
        Expect live-only sessions, smaller rooms, or daily host caps. YouTube itself is
        free for most public videos — the sync layer is what may charge. Rooms target full{" "}
        <code>youtube.com/watch</code> pages in desktop Chrome, not Shorts, embeds, or the
        native mobile app.
      </p>

      <PrimaryCheckoutCta
        pagePath="/guides/youtube-watch-party-free"
        pageTemplate="guide"
        placement="content_mid"
        className="my-10"
      />

      <h2 id="upgrade" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        When Hosts Upgrade
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Move to Plus ({PRICING_PLUS_SHORT}) when you hit the Free host cap, run weekly
        clubs, or need async reactions for friends in other time zones. Guests keep Free
        accounts. Full plan details:{" "}
        <Link href="/pricing" className="text-brand-orange hover:underline">
          pricing
        </Link>
        .
      </p>

      <h2 id="related" className="scroll-mt-24">
        Related Guides
      </h2>
      <SeoGuideRelated
        links={[
          { href: "/guides/best-apps-to-watch-youtube-together", label: "Best apps to watch YouTube together" },
                    ...relatedGuideLinks.map((g) => ({ href: g.href, label: g.label }))
        ]}
      />
    </SeoPageLayout>
  );
}
