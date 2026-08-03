import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_DISCORD_COMPARE_YOUTUBE_FAQ,
  PRICING_YT_PRICING_SNIPPET,
} from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Can You Screen Share YouTube on Discord? Better Sync (2026) | AniDachi",
  description:
    "Can you screen share YouTube on Discord? Yes — but sync a YouTube watch party instead. AniDachi keeps full watch pages aligned; Discord stays for voice. Start free at pricing.",
  alternates: {
    canonical: "/guides/can-you-screen-share-youtube-on-discord",
  },
  openGraph: {
    title: "Can You Screen Share YouTube on Discord?",
    description:
      "Go Live works for clips — sync tools win for real YouTube watch parties on Discord.",
    url: "/guides/can-you-screen-share-youtube-on-discord",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Can You Screen Share YouTube on Discord?",
    description: "Why Go Live is a weak YouTube watch party — and what to use instead.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Can you screen share YouTube on Discord?",
    answer:
      "Yes in most setups — Discord Go Live can capture a browser tab playing YouTube. Friends see your stream, but only you control the player and everyone else watches a compressed Discord feed.",
  },
  {
    question: "How do you watch YouTube together on Discord?",
    answer:
      "Best path: Discord voice + AniDachi (or similar) syncing each person's full youtube.com/watch page. Alternative: one host screen-shares YouTube via Go Live — fine for short clips, weak for long watch parties.",
  },
  {
    question: "Is Discord screen share good for a YouTube watch party?",
    answer:
      "Fine for a quick clip. For longer nights it loses to per-person YouTube playback: lower resolution, host bandwidth bottlenecks, and no guest scrubbing. Prefer AniDachi sync plus Discord voice.",
  },
  {
    question: "Why is synced YouTube better than screen share?",
    answer:
      "Each friend opens the same full youtube.com/watch page on their own connection. AniDachi keeps timestamps aligned while Discord handles conversation.",
  },
  {
    question: "Does AniDachi replace Discord?",
    answer:
      "No. Keep Discord for voice. AniDachi owns the YouTube watchroom — playback sync, chat, and optional async catch-up.",
  },
  {
    question: "How does AniDachi pricing compare to Discord screen share?",
    answer: `${PRICING_DISCORD_COMPARE_YOUTUBE_FAQ} ${PRICING_YT_PRICING_SNIPPET}`,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "limits", label: "Limits of Go Live", level: 2 },
  { id: "better-path", label: "Better path", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function CanYouScreenShareYoutubeOnDiscordPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-youtube"],
    excludeHref: "/guides/can-you-screen-share-youtube-on-discord",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "YouTube Watch Party", url: "/watch-youtube-together" },
        {
          name: "Screen share YouTube on Discord?",
          url: "/guides/can-you-screen-share-youtube-on-discord",
        },
      ]}
      title="Can you screen share YouTube on Discord?"
      description="Yes, but quality suffers. Sync YouTube watchrooms and keep Discord for voice."
      url="/guides/can-you-screen-share-youtube-on-discord"
      datePublished="2026-07-26"
      dateModified="2026-08-03"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Can You Screen Share YouTube on Discord?
      </h1>

      <h2 id="answer" className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24">
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          Yes — Discord can usually screen-share a YouTube tab — but it is a weak YouTube
          watch party.
        </strong>{" "}
        Only the host controls the player, guests watch a compressed stream, and long
        videos eat the host&apos;s upload. Better: everyone opens the same full watch
        page,{" "}
        <Link href="/watch-youtube-together" className="text-brand-orange hover:underline">
          AniDachi syncs the room
        </Link>
        , and Discord stays for voice. See{" "}
        <Link
          href="/guides/youtube-watch-party-with-discord"
          className="text-brand-orange hover:underline"
        >
          YouTube watch party with Discord
        </Link>
        .
      </p>

      <h2 id="limits" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Limits of Discord Go Live for YouTube
      </h2>
      <ul className="space-y-3 text-foreground/80 mb-8">
        <li>
          <strong>One streamer:</strong> Friends cannot pause, scrub, or fix captions on
          their own player.
        </li>
        <li>
          <strong>Quality cap:</strong> Discord re-encodes video; 1080p YouTube often
          looks softer than direct playback.
        </li>
        <li>
          <strong>Host bandwidth:</strong> The sharer uploads for the whole group —
          lag spikes pause everyone.
        </li>
      </ul>

      <PrimaryCheckoutCta
        pagePath="/guides/can-you-screen-share-youtube-on-discord"
        pageTemplate="guide"
        placement="content_mid"
        className="my-10"
      />

      <h2
        id="better-path"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Better Path: Sync + Discord Voice
      </h2>
      <ol className="list-decimal pl-6 space-y-2 text-foreground/80 mb-8">
        <li>
          Start from{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            /pricing
          </Link>{" "}
          for AniDachi early access.
        </li>
        <li>Open the same full youtube.com/watch page on every device (not Shorts or embeds).</li>
        <li>Create a watchroom and share the invite.</li>
        <li>Join a Discord voice channel — mute YouTube tabs as needed.</li>
      </ol>
      <p className="text-foreground/80 mb-8">
        Prefer no screen share at all?{" "}
        <Link
          href="/guides/how-to-watch-youtube-together-without-screen-share"
          className="text-brand-orange hover:underline"
        >
          Watch YouTube together without screen share
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
  );
}
