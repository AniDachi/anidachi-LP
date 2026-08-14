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
import { HowToJsonLd } from "@/components/json-ld";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_IS_ANIDACHI_FREE_YOUTUBE_ANSWER } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "YouTube Watch Party Chrome Extension (2026) | AniDachi",
  description:
    "Best YouTube watch party Chrome extension for 2026: AniDachi syncs full youtube.com/watch pages with chat and async catch-up. Soft-launch via /pricing — not a fake Store listing.",
  alternates: {
    canonical: "/guides/youtube-watch-party-chrome-extension",
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

    title: "YouTube Watch Party Chrome Extension",
    description:
      "Chrome extension for YouTube watch parties — AniDachi sync + async on full watch pages.",
    url: "/guides/youtube-watch-party-chrome-extension",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    images: ["/opengraph-image.png"],
    card: "summary_large_image",
    title: "YouTube Watch Party Chrome Extension",
    description: "Synced YouTube watchrooms in Chrome with AniDachi.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Is there a YouTube watch party Chrome extension?",
    answer:
      "Yes. AniDachi is a YouTube watch party Chrome extension that creates watchrooms on full youtube.com/watch pages with synced playback and chat. Teleparty is another multi-platform extension that includes YouTube for live sync only.",
  },
  {
    question: "What is the best YouTube watch party Chrome extension?",
    answer:
      "For groups that want live sync plus async catch-up on full YouTube watch pages, AniDachi is the strongest fit. Teleparty wins if you already use it for Netflix nights and only need live YouTube. Soft-launch install path: /pricing.",
  },
  {
    question: "Where do I install the AniDachi extension?",
    answer:
      "During soft launch, start from AniDachi pricing / early access (/pricing) for install instructions. Do not assume a public Chrome Web Store listing until it is live.",
  },
  {
    question: "Does the extension work on YouTube Shorts?",
    answer:
      "No. AniDachi mounts on full watch pages. Shorts, embeds, and homepage feeds are not supported.",
  },
  {
    question: "Is AniDachi free?",
    answer: PRICING_IS_ANIDACHI_FREE_YOUTUBE_ANSWER,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "what-it-does", label: "What the extension does", level: 2 },
  { id: "install", label: "How to install", level: 2 },
  { id: "limits", label: "Supported surfaces", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Open early access",
    text: "Go to /pricing and follow the current soft-launch install path for the AniDachi Chrome extension.",
  },
  {
    name: "Pin the extension",
    text: "Pin AniDachi in Chrome so the toolbar icon is easy to reach during YouTube nights.",
  },
  {
    name: "Open a YouTube video",
    text: "Navigate to a full youtube.com/watch page.",
  },
  {
    name: "Create a watchroom",
    text: "Create a YouTube watchroom and share the invite with friends.",
  },
];

export default function YoutubeWatchPartyChromeExtensionPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["youtube", "pillar-watch-youtube"],
    excludeHref: "/guides/youtube-watch-party-chrome-extension",
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="How to install a YouTube watch party Chrome extension"
        description="Install AniDachi and create a YouTube watchroom from a full watch page."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "YouTube Watch Party", url: "/watch-youtube-together" },
          {
            name: "YouTube watch party Chrome extension",
            url: "/guides/youtube-watch-party-chrome-extension",
          },
        ]}
        title="YouTube watch party Chrome extension"
        description="AniDachi’s Chrome extension for YouTube watchrooms — install path and limits."
        url="/guides/youtube-watch-party-chrome-extension"
        datePublished="2026-07-25"
        dateModified="2026-08-12"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta
      >
        <SeoGuideTitle>YouTube Watch Party Chrome Extension</SeoGuideTitle>

        <h2 id="answer" className="scroll-mt-24">
        Short Answer
      </h2>
      <SeoGuideAnswer>

          <strong>
            AniDachi is a YouTube watch party Chrome extension: open a full watch
            page, create a watchroom, and sync with friends — live or async.
          </strong>{" "}
          Soft launch starts at{" "}
          <Link href="/pricing">
            pricing / early access
          </Link>
          , not a fabricated Store badge. Hub:{" "}
          <Link
            href="/watch-youtube-together"
          >
            YouTube watch party
          </Link>
          . Teleparty compare:{" "}
          <Link
            href="/guides/does-teleparty-work-with-youtube"
          >
            Does Teleparty work with YouTube?
          </Link>
        
      </SeoGuideAnswer>

        <h2
          id="what-it-does"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          What the extension does
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
          <li>Provider-pinned YouTube watchrooms with sync and chat.</li>
          <li>Async catch-up when schedules do not overlap.</li>
          <li>
            Same product for{" "}
            <Link
              href="/watch-crunchyroll-together"
              className="text-brand-orange hover:underline"
            >
              Crunchyroll anime nights
            </Link>
            .
          </li>
        </ul>

        <h2
          id="install"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          How to install
        </h2>
      <SeoGuideSteps steps={howToSteps} />

        <h2
          id="limits"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Supported surfaces
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Full <strong>youtube.com/watch</strong> pages are supported. Shorts,
          embeds, and homepage feeds are not. Desktop Chrome is required for the
          extension overlay.
        </p>

        <h2 id="related" className="scroll-mt-24">
        Related
      </h2>
      <SeoGuideRelated
        links={[
          { href: "/watch-youtube-together", label: "YouTube watch party hub" },
                    { href: "/guides/how-to-watch-youtube-with-friends", label: "How to watch YouTube with friends" },
                    ...relatedGuideLinks.map((g) => ({ href: g.href, label: g.label }))
        ]}
      />
      </SeoPageLayout>
    </>
  );
}
