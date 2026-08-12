import type { Metadata } from "next";
import Link from "next/link";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideRelated,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_RAVE_COMPARE_YOUTUBE_FAQ } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Does Rave Work With YouTube? (2026 Answer) | AniDachi",
  description:
    "Yes — Rave can sync YouTube for live watch parties. It does not support async catch-up. Compare Rave for YouTube vs AniDachi watchrooms.",
  alternates: { canonical: "/guides/does-rave-work-with-youtube" },
  openGraph: {
    title: "Does Rave Work With YouTube?",
    description:
      "Rave supports YouTube live sync — but not async watchrooms. When to switch.",
    url: "/guides/does-rave-work-with-youtube",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Does Rave Work With YouTube?",
    description: "Live sync yes; async no. How Rave for YouTube compares to AniDachi.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Does Rave work with YouTube?",
    answer:
      "Yes. Rave can sync YouTube videos for live watch parties when everyone is online together. It is not built for async catch-up or durable YouTube watchrooms across time zones.",
  },
  {
    question: "Is Rave free for YouTube?",
    answer:
      "Rave offers a free tier for many live sessions. Features and limits change over time — verify on Rave’s site before invite night.",
  },
  {
    question: "Rave vs AniDachi for YouTube — which should I pick?",
    answer:
      "Pick Rave if you want a free live hang with built-in calling and already like their UI. Pick AniDachi when you need async YouTube catch-up or also host Crunchyroll anime nights in one Chrome extension.",
  },
  {
    question: "How does AniDachi pricing compare to Rave?",
    answer: PRICING_RAVE_COMPARE_YOUTUBE_FAQ,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "how-it-works", label: "How Rave + YouTube works", level: 2 },
  { id: "limits", label: "Where Rave falls short", level: 2 },
  { id: "when-to-switch", label: "When to switch tools", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function DoesRaveWorkWithYoutubePage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-youtube"],
    excludeHref: "/guides/does-rave-work-with-youtube",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "YouTube Watch Party", url: "/watch-youtube-together" },
        {
          name: "Does Rave work with YouTube?",
          url: "/guides/does-rave-work-with-youtube",
        },
      ]}
      title="Does Rave work with YouTube?"
      description="Rave can sync YouTube live — compare limits vs AniDachi watchrooms."
      url="/guides/does-rave-work-with-youtube"
      datePublished="2026-08-11"
      dateModified="2026-08-12"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <SeoGuideTitle>Does Rave Work With YouTube?</SeoGuideTitle>

      <h2 id="answer" className="scroll-mt-24">
        Short Answer
      </h2>
      <SeoGuideAnswer>
        <strong>
          Yes — Rave can work with YouTube for live, synchronized watch parties
          when everyone is online together.
        </strong>{" "}
        It does not offer async catch-up for staggered schedules. If your group
        watches YouTube across time zones — or also needs Crunchyroll anime
        nights — you will outgrow Rave for those sessions. Hub:{" "}
        <Link href="/watch-youtube-together">YouTube watch party</Link>.
      </SeoGuideAnswer>

      <h2 id="how-it-works" className="scroll-mt-24">
        How Rave + YouTube works
      </h2>
      <p>
        Each person joins a Rave room, opens the same YouTube video, and Rave
        keeps play/pause roughly aligned. Voice or video calling may be built
        in, which is why some groups prefer it over Teleparty for casual hangs.
        Full watch pages work best — treat Shorts and embeds as unreliable.
      </p>

      <h2 id="limits" className="scroll-mt-24">
        Where Rave falls short
      </h2>
      <SeoGuideBulletList
        items={[
          { body: "Live-only — no async YouTube watchrooms." },
          {
            body: "Not built around Crunchyroll anime detection or episode progress.",
          },
          {
            body: (
              <>
                Not the same dual Crunchyroll + YouTube workflow as{" "}
                <Link
                  href="/watch-youtube-together"
                  className="font-medium text-brand-orange hover:underline"
                >
                  AniDachi’s YouTube hub
                </Link>
                .
              </>
            ),
          },
        ]}
      />

      <PrimaryCheckoutCta
        pagePath="/guides/does-rave-work-with-youtube"
        pageTemplate="guide"
        placement="content_mid"
        className="my-10"
      />

      <h2 id="when-to-switch" className="scroll-mt-24">
        When to switch tools
      </h2>
      <p>
        Stay on Rave if live YouTube nights with built-in calling already work.
        Switch to AniDachi when you need async catch-up or also host Crunchyroll.
        Compare:{" "}
        <Link
          href="/compare/anidachi-vs-rave"
          className="text-brand-orange hover:underline"
        >
          AniDachi vs Rave
        </Link>
        . Ranked options:{" "}
        <Link
          href="/guides/rave-alternatives-for-youtube"
          className="text-brand-orange hover:underline"
        >
          Rave alternatives for YouTube
        </Link>
        . Checkout:{" "}
        <Link href="/pricing" className="text-brand-orange hover:underline">
          /pricing
        </Link>
        .
      </p>

      <h2 id="related" className="scroll-mt-24">
        Related
      </h2>
      <SeoGuideRelated
        links={[
          { href: "/watch-youtube-together", label: "YouTube watch party hub" },
          ...relatedGuideLinks.map((g) => ({ href: g.href, label: g.label })),
        ]}
      />
    </SeoPageLayout>
  );
}
