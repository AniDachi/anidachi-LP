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
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_IS_ANIDACHI_FREE_YOUTUBE_ANSWER,
  PRICING_PLUS_SHORT,
} from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Free YouTube Watch Party — Free Tier Options (2026) | AniDachi",
  description:
    "Compare free YouTube watch party options. AniDachi guests join free; hosts need Plus or Pro, including an active trial. Compare Teleparty and Watch2Gether.",
  alternates: { canonical: "/guides/youtube-watch-party-free" },
  openGraph: {
    title: "Free YouTube Watch Party Options",
    description:
      "AniDachi Free vs Teleparty vs Watch2Gether — free joining, hosting requirements, and live playback.",
    url: "/guides/youtube-watch-party-free",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free YouTube Watch Party Options",
    description: "Free YouTube watch party options, with AniDachi hosting and joining explained.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Is there a free YouTube watch party?",
    answer:
      "You can join an AniDachi room on a Free account when its host has active Plus or Pro access, including a trial. Creating your own room requires that access. Teleparty and Watch2Gether offer other live-sync options.",
  },
  {
    question: "Is AniDachi free for YouTube watch parties?",
    answer: PRICING_IS_ANIDACHI_FREE_YOUTUBE_ANSWER,
  },
  {
    question: "What is the best free YouTube watch party app?",
    answer:
      "Watch2Gether offers browser rooms, while Teleparty offers extension-based live sync. With AniDachi, friends join free when a host has active Plus or Pro access, including a trial. See best apps to watch YouTube together for a fuller comparison.",
  },
  {
    question: "Does YouTube itself offer a free watch party?",
    answer:
      "For AniDachi watchrooms, use full youtube.com/watch pages in desktop Chrome. AniDachi does not support Shorts, embeds, feeds, or the native YouTube mobile app. Other watch-together features depend on your device and service.",
  },
  {
    question: "When should the host upgrade from Free?",
    answer: `Choose Plus (${PRICING_PLUS_SHORT} on monthly billing) or Pro to create your own rooms. Eligible Free accounts can start a three-day card trial once per account. Guests can stay on Free; see pricing for renewal and cancellation terms.`,
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
      description="Free YouTube watch party options and AniDachi hosting requirements."
      url="/guides/youtube-watch-party-free"
      datePublished="2026-07-26"
      dateModified="2026-10-01"
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
          AniDachi is free to join when the room host has Plus or Pro access,
          including an active trial. Free accounts cannot create rooms.
        </strong>{" "}
        To host your own live watch party, choose a plan on{" "}
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
          <strong>AniDachi Free:</strong> Join an active Plus or Pro host, including
          a trial host. Creating rooms requires your own Plus or Pro access.
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
        Free access differs by tool. On AniDachi it covers joining a host&apos;s live
        room. Public YouTube video access is separate from hosting. AniDachi rooms use full{" "}
        <code>youtube.com/watch</code> pages in desktop Chrome, not Shorts, embeds, or the
        native mobile app.
      </p>


      <h2 id="upgrade" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        When Hosts Upgrade
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Choose Plus ({PRICING_PLUS_SHORT} on monthly billing) or Pro to host.
        An eligible account can use one three-day card trial across both plans.
        The selected monthly or yearly subscription renews automatically; cancel
        before the trial ends to avoid the first charge. Guests keep Free accounts.
        Full plan details:{" "}
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
