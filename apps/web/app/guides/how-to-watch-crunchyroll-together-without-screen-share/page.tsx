import type { Metadata } from "next";
import Link from "next/link";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
import {
  SeoGuideAnswer,
  SeoGuideNote,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_CR_PRICING_SNIPPET } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Watch Crunchyroll Without Screen Share — AniDachi",
  description:
    "How to watch Crunchyroll with friends without screen share: synced watchrooms so everyone streams locally in full quality. Keep Discord for voice only.",
  alternates: {
    canonical: "/guides/how-to-watch-crunchyroll-together-without-screen-share",
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

    title: "Watch Crunchyroll Without Screen Share",
    description:
      "Skip low-quality Discord Go Live — sync local Crunchyroll playback instead.",
    url: "/guides/how-to-watch-crunchyroll-together-without-screen-share",
  },
  twitter: {
    images: ["/opengraph-image.png"],
    card: "summary_large_image",
    title: "Watch Crunchyroll Without Screen Share",
    description: "Synced Crunchyroll watchrooms beat Discord Go Live for quality.",
  },
};

const howToStepsPlain = [
  {
    name: "Get AniDachi from pricing",
    text: 'Open /pricing for early access and install the AniDachi Chrome extension — do not hunt a generic Chrome Web Store "Add to Chrome" link.',
  },
  {
    name: "Open Crunchyroll",
    text: "Navigate to the anime episode on Crunchyroll in desktop Chrome.",
  },
  {
    name: "Create a watchroom",
    text: "Detect the title and create a Crunchyroll watchroom.",
  },
  {
    name: "Share the invite",
    text: "Send the room link so friends join on their own Crunchyroll accounts.",
  },
  {
    name: "Stream locally",
    text: "Each person watches on their own Crunchyroll tab while the room syncs playback. Use Discord for voice only.",
  },
];

const howToSteps = [
  {
    name: howToStepsPlain[0].name,
    text: (
      <>
        Open <Link href="/pricing">/pricing</Link> for early access and install
        the AniDachi Chrome extension — do not hunt a generic Chrome Web Store
        &quot;Add to Chrome&quot; link.
      </>
    ),
  },
  ...howToStepsPlain.slice(1),
];

const faq = [
  {
    question: "Can you watch Crunchyroll together without screen sharing?",
    answer:
      "Yes. Use a watchroom tool such as AniDachi so everyone streams the episode locally while playback stays synced.",
  },
  {
    question: "Is synced playback better than Discord screen share?",
    answer:
      "For quality and control, yes. Synced playback avoids one host’s stream becoming the bottleneck. Discord Go Live of Crunchyroll is unreliable and compresses video — see can you screen share Crunchyroll on Discord.",
  },
  {
    question: "Do all viewers need a Crunchyroll account?",
    answer:
      "Yes — each person needs their own Crunchyroll access to stream. AniDachi provides the watchroom, sync, and chat layer on top.",
  },
  {
    question: "Is AniDachi free?",
    answer: `Free to join with limited hosting. ${PRICING_CR_PRICING_SNIPPET}`,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "why-not-screen-share", label: "Why avoid screen share?", level: 2 },
  { id: "steps", label: "Step-by-step setup", level: 2 },
  { id: "discord", label: "Discord voice note", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function HowToWatchCrunchyrollTogetherWithoutScreenSharePage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-crunchyroll"],
    excludeHref:
      "/guides/how-to-watch-crunchyroll-together-without-screen-share",
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="How to watch Crunchyroll together without screen share"
        description="Set up an AniDachi Crunchyroll watchroom so everyone streams locally."
        steps={howToStepsPlain}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          {
            name: "Watch Crunchyroll Together",
            url: "/watch-crunchyroll-together",
          },
          {
            name: "Watch Crunchyroll without screen share",
            url: "/guides/how-to-watch-crunchyroll-together-without-screen-share",
          },
        ]}
        title="Watch Crunchyroll without screen share"
        description="Synced Crunchyroll watchrooms so everyone streams locally — Discord for voice only."
        url="/guides/how-to-watch-crunchyroll-together-without-screen-share"
        datePublished="2026-08-11"
        dateModified="2026-08-12"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta
      >
        <SeoGuideTitle>
          How to Watch Crunchyroll Together Without Screen Share
        </SeoGuideTitle>

        <h2 id="why-not-screen-share" className="scroll-mt-24">
          Why avoid screen share?
        </h2>
        <SeoGuideAnswer>
          <strong>
            Discord Go Live and screen share compress Crunchyroll, put one host
            in control of pause/seek, and often break mid-episode.
          </strong>{" "}
          A watchroom lets everyone stream from their own Crunchyroll account in
          full quality while AniDachi keeps playback aligned. Capability check:{" "}
          <Link href="/guides/can-you-screen-share-crunchyroll-on-discord">
            can you screen share Crunchyroll on Discord?
          </Link>
          .
        </SeoGuideAnswer>

        <h2 id="steps" className="scroll-mt-24">
          Step-by-step setup
        </h2>
        <SeoGuideSteps steps={howToSteps} />

        <PrimaryCheckoutCta
          pagePath="/guides/how-to-watch-crunchyroll-together-without-screen-share"
          pageTemplate="guide"
          placement="content_mid"
          className="my-10"
        />

        <h2 id="discord" className="scroll-mt-24">
          Discord voice note
        </h2>
        <SeoGuideNote>
          Keep Discord for voice and reactions. Do not Go Live the Crunchyroll
          tab. Hybrid pattern:{" "}
          <Link href="/guides/crunchyroll-watch-party-with-discord">
            Crunchyroll watch party with Discord
          </Link>
          . Switching from Go Live permanently?{" "}
          <Link href="/guides/switch-from-discord-screen-share">
            Switch from Discord screen share
          </Link>
          .
        </SeoGuideNote>

        <h2 id="related" className="scroll-mt-24">
          Related guides
        </h2>
        <SeoGuideRelated
          links={[
            {
              href: "/watch-crunchyroll-together",
              label: "Crunchyroll watch party hub",
            },
            ...relatedGuideLinks.map((g) => ({
              href: g.href,
              label: g.label,
            })),
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
