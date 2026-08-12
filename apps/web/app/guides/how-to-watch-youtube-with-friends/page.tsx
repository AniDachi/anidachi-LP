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
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_IS_ANIDACHI_FREE_YOUTUBE_ANSWER } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "How to Watch YouTube With Friends (2026 Guide) | AniDachi",
  description:
    "Step-by-step: how to watch YouTube with friends (and how to watch YouTube together) using AniDachi watchrooms — live sync or async. Free alternatives included.",
  alternates: { canonical: "/guides/how-to-watch-youtube-with-friends" },
  openGraph: {
    title: "How to Watch YouTube With Friends",
    description:
      "Create a YouTube watchroom in minutes — synced playback, chat, and async catch-up.",
    url: "/guides/how-to-watch-youtube-with-friends",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Watch YouTube With Friends",
    description: "Synced YouTube watchrooms with AniDachi — live or async.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "How do I watch YouTube with friends?",
    answer:
      "Install the AniDachi Chrome extension, open a full YouTube watch page, create a watchroom, and share the invite link. Friends join on their own YouTube sessions while playback stays synced for live nights.",
  },
  {
    question: "How do I watch YouTube together (same question)?",
    answer:
      "“Watch YouTube together” and “watch YouTube with friends” are the same job: a third-party sync layer. Use AniDachi for watchrooms with optional async, or Watch2Gether for a free live-only browser room.",
  },
  {
    question: "Does YouTube have a built-in watch together feature?",
    answer:
      "No. YouTube does not ship a native watch party. You need AniDachi, Watch2Gether, Teleparty, or a manual countdown on a video call.",
  },
  {
    question: "Is AniDachi free?",
    answer: PRICING_IS_ANIDACHI_FREE_YOUTUBE_ANSWER,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "steps", label: "Step-by-step", level: 2 },
  { id: "together", label: "Watch YouTube together", level: 2 },
  { id: "alternatives", label: "Free alternatives", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Get AniDachi",
    text: "Open /pricing for early access and install the AniDachi Chrome extension.",
  },
  {
    name: "Open the video",
    text: "Navigate to a full youtube.com/watch page (not Shorts or embeds).",
  },
  {
    name: "Create the watchroom",
    text: "Create a YouTube watchroom and copy the invite link.",
  },
  {
    name: "Invite friends",
    text: "Share the link so each friend joins on their own YouTube account.",
  },
  {
    name: "Watch live or async",
    text: "Sync for a live hang, or leave reactions when someone watches later.",
  },
];

export default function HowToWatchYoutubeWithFriendsPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["youtube", "pillar-watch-youtube", "how-to-core"],
    excludeHref: "/guides/how-to-watch-youtube-with-friends",
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="How to watch YouTube with friends"
        description="Set up an AniDachi YouTube watchroom for synced or async co-watching."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "YouTube Watch Party", url: "/watch-youtube-together" },
          {
            name: "How to watch YouTube with friends",
            url: "/guides/how-to-watch-youtube-with-friends",
          },
        ]}
        title="How to watch YouTube with friends"
        description="Step-by-step YouTube watchroom setup — live sync or async catch-up."
        url="/guides/how-to-watch-youtube-with-friends"
        datePublished="2026-07-25"
        dateModified="2026-08-12"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta
      >
        <SeoGuideTitle>How to Watch YouTube With Friends</SeoGuideTitle>

        <h2 id="answer" className="scroll-mt-24">
        Short Answer
      </h2>
      <SeoGuideAnswer>

          <strong>
            Create an AniDachi YouTube watchroom, share the invite, and watch on
            each person’s own YouTube tab — synced for live hangs, async when
            schedules conflict.
          </strong>{" "}
          Full hub:{" "}
          <Link
            href="/watch-youtube-together"
          >
            YouTube watch party
          </Link>
          . Checkout:{" "}
          <Link href="/pricing">
            pricing / early access
          </Link>
          .
        
      </SeoGuideAnswer>

        <h2
          id="steps"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Step-by-step
        </h2>
      <SeoGuideSteps steps={howToSteps} />

        <PrimaryCheckoutCta
          pagePath="/guides/how-to-watch-youtube-with-friends"
          pageTemplate="guide"
          placement="content_mid"
          className="my-10"
        />

        <h2
          id="together"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          How to watch YouTube together (same workflow)
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Searches for “how to watch YouTube together” map to the same setup:
          third-party sync on top of each viewer’s YouTube stream. AniDachi is
          the watchroom path; for long-distance schedules see{" "}
          <Link
            href="/watch-youtube-together-long-distance"
            className="text-brand-orange hover:underline"
          >
            watch YouTube together long distance
          </Link>
          .
        </p>

        <h2
          id="alternatives"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Free live-only alternatives
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
          <li>
            <strong>Watch2Gether</strong> — browser room, paste a YouTube URL.
          </li>
          <li>
            <strong>Teleparty</strong> — Chrome extension; live sync only (
            <Link
              href="/guides/does-teleparty-work-with-youtube"
              className="text-brand-orange hover:underline"
            >
              details
            </Link>
            ).
          </li>
          <li>
            <strong>Discord</strong> — voice + AniDachi sync beats Go Live quality
            (
            <Link
              href="/guides/youtube-watch-party-with-discord"
              className="text-brand-orange hover:underline"
            >
              hybrid guide
            </Link>
            ).
          </li>
        </ul>

        <h2 id="related" className="scroll-mt-24">
        Related
      </h2>
      <SeoGuideRelated
        links={[
          { href: "/guides/best-way-to-watch-youtube-with-friends", label: "Best way to watch YouTube with friends" },
                    { href: "/watch-youtube-together", label: "YouTube watch party hub" },
                    { href: "/guides/youtube-watch-party-chrome-extension", label: "YouTube watch party Chrome extension" },
                    { href: "/guides/best-apps-to-watch-youtube-together", label: "Best apps to watch YouTube together" },
                    ...relatedGuideLinks.map((g) => ({ href: g.href, label: g.label }))
        ]}
      />
      </SeoPageLayout>
    </>
  );
}
