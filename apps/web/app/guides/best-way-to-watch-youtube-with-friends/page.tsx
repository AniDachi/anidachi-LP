import type { Metadata } from "next";
import Link from "next/link";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
import {
  SeoGuideAnswer,
  SeoGuideOptions,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_COMPARE_OVERVIEW_YOUTUBE,
  PRICING_IS_ANIDACHI_FREE_YOUTUBE_ANSWER,
} from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Best Way to Watch YouTube With Friends (2026 Verdict) | AniDachi",
  description:
    "Verdict: sync, async, or screen share? For most groups the best way to watch YouTube with friends is AniDachi watchrooms — not Discord Go Live.",
  alternates: {
    canonical: "/guides/best-way-to-watch-youtube-with-friends",
  },
  openGraph: {
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "AniDachi – watch anime together, in perfect sync",
      },
    ],

    title: "Best Way to Watch YouTube With Friends",
    description:
      "Method decision page: live sync vs async vs screen share — and why AniDachi wins for most crews.",
    url: "/guides/best-way-to-watch-youtube-with-friends",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    images: ["/opengraph-image.png"],
    card: "summary_large_image",
    title: "Best Way to Watch YouTube With Friends",
    description: "Sync vs async vs screen share — clear verdict for YouTube groups.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "What is the best way to watch YouTube with friends?",
    answer:
      "For most groups in 2026, the best way is a synced watchroom where everyone streams YouTube locally — AniDachi for live sync plus async catch-up. Screen share is a last resort; pure honor-system countdowns break on mid-video seeks.",
  },
  {
    question: "Is live sync or async better for YouTube?",
    answer:
      "Live sync wins for premieres and reaction nights. Async wins when time zones or work schedules never overlap. AniDachi supports both in one watchroom so you do not pick a permanent camp.",
  },
  {
    question: "Is this the same as how to watch YouTube with friends?",
    answer:
      "No. That how-to walks setup steps. This page is a method verdict — which approach to choose — then points you to pricing and deeper guides once you decide.",
  },
  {
    question: "Is AniDachi free?",
    answer: PRICING_IS_ANIDACHI_FREE_YOUTUBE_ANSWER,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "verdict", label: "Verdict", level: 2 },
  { id: "methods", label: "Method comparison", level: 2 },
  { id: "decision", label: "Decision tree", level: 2 },
  { id: "next", label: "What to do next", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function BestWayToWatchYoutubeWithFriendsPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-youtube"],
    excludeHref: "/guides/best-way-to-watch-youtube-with-friends",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "YouTube Watch Party", url: "/watch-youtube-together" },
        {
          name: "Best way to watch YouTube with friends",
          url: "/guides/best-way-to-watch-youtube-with-friends",
        },
      ]}
      title="Best way to watch YouTube with friends"
      description="Method verdict: sync vs async vs screen share for YouTube watch parties."
      url="/guides/best-way-to-watch-youtube-with-friends"
      datePublished="2026-08-11"
      dateModified="2026-08-12"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <SeoGuideTitle>
        Best Way to Watch YouTube With Friends (2026 Verdict)
      </SeoGuideTitle>

      <h2 id="verdict" className="scroll-mt-24">
        Verdict
      </h2>
      <SeoGuideAnswer>
        <strong>
          The best way for most groups is AniDachi: everyone streams a full
          youtube.com/watch page in their own browser while a watchroom handles
          sync, chat, and optional async catch-up.
        </strong>{" "}
        Screen share loses on quality. Live-only free tools are fine for
        same-time nights — until schedules diverge. This is a decision page, not
        a clone of the{" "}
        <Link href="/guides/how-to-watch-youtube-with-friends">
          how to watch YouTube with friends
        </Link>{" "}
        setup guide. Shorts, embeds, and the native mobile apps are not
        supported.
      </SeoGuideAnswer>
      <p>
        {PRICING_COMPARE_OVERVIEW_YOUTUBE} Full details on{" "}
        <Link
          href="/pricing"
          className="font-medium text-brand-orange hover:underline"
        >
          /pricing
        </Link>
        .
      </p>

      <h2 id="methods" className="scroll-mt-24">
        Method comparison
      </h2>
      <div className="not-prose mb-10">
        <ResponsiveCompareTable
          columns={[
            { id: "anidachi", label: "AniDachi", highlight: true },
            { id: "livefree", label: "Live-only tool" },
            { id: "screenshare", label: "Screen share" },
          ]}
          rows={[
            {
              feature: "Full YouTube quality",
              values: { anidachi: "yes", livefree: "yes", screenshare: "no" },
            },
            {
              feature: "Live sync",
              values: { anidachi: "yes", livefree: "yes", screenshare: "partial" },
            },
            {
              feature: "Async catch-up",
              values: { anidachi: "yes", livefree: "no", screenshare: "no" },
            },
            {
              feature: "Everyone has own controls",
              values: { anidachi: "yes", livefree: "yes", screenshare: "no" },
            },
            {
              feature: "Best for time zones",
              values: { anidachi: "yes", livefree: "no", screenshare: "no" },
            },
          ]}
        />
      </div>

      <PrimaryCheckoutCta
        pagePath="/guides/best-way-to-watch-youtube-with-friends"
        pageTemplate="guide"
        placement="content_mid"
        className="my-10"
      />

      <h2 id="decision" className="scroll-mt-24">
        Decision tree
      </h2>
      <SeoGuideOptions
        options={[
          {
            title: "Everyone can start within 5 minutes tonight?",
            body: "Live sync (AniDachi, Teleparty, or Watch2Gether) is enough.",
          },
          {
            title: "Someone always watches tomorrow?",
            highlight: true,
            body: "Pick AniDachi async — do not rely on Discord Go Live recordings.",
          },
          {
            title: "Only need voice + any video?",
            body: "Discord Go Live works, but quality suffers — keep Discord for voice and sync the YouTube tabs.",
          },
        ]}
      />

      <h2 id="next" className="scroll-mt-24">
        What to do next
      </h2>
      <SeoGuideSteps
        steps={[
          {
            name: "Open pricing / early access",
            text: (
              <>
                Start at{" "}
                <Link href="/pricing">AniDachi pricing / early access</Link> and
                install the Chrome extension.
              </>
            ),
          },
          {
            name: "Follow the setup how-to",
            text: (
              <>
                Walk through{" "}
                <Link href="/guides/how-to-watch-youtube-with-friends">
                  how to watch YouTube with friends
                </Link>
                .
              </>
            ),
          },
          {
            name: "Compare more tools if needed",
            text: (
              <>
                Browse{" "}
                <Link href="/guides/best-apps-to-watch-youtube-together">
                  best apps to watch YouTube together
                </Link>
                .
              </>
            ),
          },
        ]}
      />

      <h2 id="related" className="scroll-mt-24">
        Related guides
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
