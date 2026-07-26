import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_YT_PRICING_SNIPPET } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Watch YouTube Together Without Screen Share — AniDachi",
  description:
    "How to watch YouTube together without screen share: synced watchrooms so everyone streams locally in better quality. Keep Discord for voice only.",
  alternates: {
    canonical: "/guides/how-to-watch-youtube-together-without-screen-share",
  },
  openGraph: {
    title: "Watch YouTube Together Without Screen Share",
    description:
      "Skip low-quality screen share — sync local YouTube playback instead.",
    url: "/guides/how-to-watch-youtube-together-without-screen-share",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Watch YouTube Together Without Screen Share",
    description: "Synced YouTube watchrooms beat Discord Go Live for quality.",
    images: [BRAND_OG_PATH],
  },
};

const howToSteps = [
  {
    name: "Install AniDachi",
    text: "Add the Chrome extension before opening the YouTube video.",
  },
  {
    name: "Open YouTube",
    text: "Go to the full youtube.com/watch page your group wants.",
  },
  {
    name: "Create a watchroom",
    text: "Use AniDachi to create a room pinned to that video.",
  },
  { name: "Share the invite", text: "Send the room link to friends." },
  {
    name: "Stream locally",
    text: "Each person watches on their own YouTube tab while the room syncs playback.",
  },
];

const faq = [
  {
    question: "Can you watch YouTube together without screen sharing?",
    answer:
      "Yes. Use a watchroom tool such as AniDachi so everyone streams the video locally while playback stays synced.",
  },
  {
    question: "Is synced playback better than Discord screen share?",
    answer:
      "For quality, yes. Synced playback avoids one host’s stream becoming the bottleneck. Discord Go Live of YouTube works more often than Crunchyroll — but still compresses video. See can you screen share YouTube on Discord.",
  },
  {
    question: "Do all viewers need a YouTube account?",
    answer:
      "Most public videos play without signing in, but each person needs their own browser session on the full watch page. AniDachi does not re-stream the video for them.",
  },
  {
    question: "Is AniDachi free?",
    answer: `Free to join with limited hosting. ${PRICING_YT_PRICING_SNIPPET}`,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "why-not-screen-share", label: "Why avoid screen share?", level: 2 },
  { id: "steps", label: "Step-by-step setup", level: 2 },
  { id: "discord", label: "Discord voice note", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function HowToWatchYoutubeTogetherWithoutScreenSharePage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-youtube"],
    excludeHref: "/guides/how-to-watch-youtube-together-without-screen-share",
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="How to watch YouTube together without screen share"
        description="Set up an AniDachi YouTube watchroom so everyone streams locally."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "YouTube Watch Party", url: "/watch-youtube-together" },
          {
            name: "Without screen share",
            url: "/guides/how-to-watch-youtube-together-without-screen-share",
          },
        ]}
        title="Watch YouTube together without screen share"
        description="Skip screen share — sync local YouTube playback with AniDachi watchrooms."
        url="/guides/how-to-watch-youtube-together-without-screen-share"
        datePublished="2026-07-26"
        dateModified="2026-07-26"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          Watch YouTube Together Without Screen Share
        </h1>

        <h2
          id="why-not-screen-share"
          className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
        >
          Why Avoid Screen Share?
        </h2>
        <p className="text-xl text-foreground/80 leading-relaxed mb-6">
          <strong>
            Screen share turns one friend into the group&apos;s video server — softer
            picture, host lag, and no guest controls.
          </strong>{" "}
          A YouTube watch party should let everyone stream the same full watch page while
          a sync layer keeps timestamps aligned. Start at{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            /pricing
          </Link>
          .
        </p>

        <h2 id="steps" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
          Step-by-Step Setup
        </h2>
        <ol className="list-decimal pl-6 space-y-2 text-foreground/80 mb-8">
          {howToSteps.map((step) => (
            <li key={step.name}>
              <strong>{step.name}:</strong> {step.text}
            </li>
          ))}
        </ol>

        <h2 id="discord" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
          Discord Voice Note
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Keep Discord for talking. If you were relying on Go Live for video, migrate
          using{" "}
          <Link
            href="/guides/can-you-screen-share-youtube-on-discord"
            className="text-brand-orange hover:underline"
          >
            can you screen share YouTube on Discord
          </Link>{" "}
          and{" "}
          <Link
            href="/guides/youtube-watch-party-with-discord"
            className="text-brand-orange hover:underline"
          >
            YouTube watch party with Discord
          </Link>
          .
        </p>

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
    </>
  );
}
