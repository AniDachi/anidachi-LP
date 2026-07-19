import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_DISCORD_COMPARE_FAQ } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Can You Screen Share Crunchyroll on Discord? (2026) | AniDachi",
  description:
    "Often blocked or low quality: Discord Go Live of Crunchyroll usually means one streamer, black screens, and legal account issues. Better options without screen share.",
  alternates: {
    canonical: "/guides/can-you-screen-share-crunchyroll-on-discord",
  },
  openGraph: {
    title: "Can You Screen Share Crunchyroll on Discord?",
    description:
      "Why Crunchyroll on Discord Go Live fails — and how to watch together without screen share.",
    url: "/guides/can-you-screen-share-crunchyroll-on-discord",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Can You Screen Share Crunchyroll on Discord?",
    description:
      "Blocked streams, poor quality, one streamer — plus legal account notes.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Can you screen share Crunchyroll on Discord?",
    answer:
      "Sometimes — but it is unreliable. Many users hit a black screen or blocked capture when Go Live tries to share the Crunchyroll player. Even when it works, only one person streams while others watch a compressed Discord feed.",
  },
  {
    question: "Why does Discord show a black screen for Crunchyroll?",
    answer:
      "Streaming services often use protected media paths that browsers and Discord’s screen capture cannot re-encode cleanly. Hardware acceleration, browser choice, and DRM-related protections all contribute. It is a known pain point, not a one-off bug.",
  },
  {
    question: "Is it legal to screen share Crunchyroll to friends?",
    answer:
      "Each viewer should have their own legitimate Crunchyroll access for the content they watch. Sharing one paid stream as the only video source for a group can conflict with Crunchyroll’s terms and leaves friends without their own playback rights. Prefer a model where everyone streams locally.",
  },
  {
    question: "What should we use instead of Discord screen share?",
    answer:
      "Keep Discord for voice. Use AniDachi (or another sync tool) so each person opens Crunchyroll in their own browser. See our without-screen-share guide and the Discord migration playbook.",
  },
  {
    question: "Is AniDachi free compared to Discord screen share?",
    answer: PRICING_DISCORD_COMPARE_FAQ,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "why-it-fails", label: "Why Go Live fails", level: 2 },
  { id: "legal", label: "Accounts and fair use of access", level: 2 },
  { id: "better-path", label: "Better path", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function CanYouScreenShareCrunchyrollOnDiscordPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["discord", "online", "crunchyroll"],
    excludeHref: "/guides/can-you-screen-share-crunchyroll-on-discord",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Guides", url: "/watch-anime-together" },
        {
          name: "Screen share Crunchyroll on Discord?",
          url: "/guides/can-you-screen-share-crunchyroll-on-discord",
        },
      ]}
      title="Can you screen share Crunchyroll on Discord?"
      description="Often blocked or poor quality — why Discord Go Live struggles with Crunchyroll and what to use instead."
      url="/guides/can-you-screen-share-crunchyroll-on-discord"
      datePublished="2026-07-19"
      dateModified="2026-07-19"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta={true}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Can You Screen Share Crunchyroll on Discord?
      </h1>

      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          Often no — or only with poor quality. Discord Go Live of Crunchyroll is
          frequently blocked (black screen), bitrate-starved, and limited to one
          streamer while everyone else watches a compressed feed.
        </strong>{" "}
        Even when capture works, friends do not get their own player controls or
        full Crunchyroll quality. For weekly anime nights, screen share is the
        wrong tool.
      </p>

      <h2
        id="why-it-fails"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Why Discord Go Live fails on Crunchyroll
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
        <li>
          <strong>Protected playback</strong> — the player may refuse to be
          captured cleanly, resulting in a black Discord preview.
        </li>
        <li>
          <strong>One uplink</strong> — the host’s upload bandwidth becomes
          everyone’s video quality.
        </li>
        <li>
          <strong>No per-user controls</strong> — guests cannot pause, seek
          subtitles, or fix their own stream without yelling at the host.
        </li>
        <li>
          <strong>Audio double-path mess</strong> — Discord voice + shared
          browser audio often desyncs; see delay troubleshooting if you insist on
          trying.
        </li>
      </ul>

      <h2
        id="legal"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Accounts and fair use of access
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-8">
        AniDachi is not affiliated with Crunchyroll or Discord. Practically and
        contractually, each person who watches should stream under their own
        Crunchyroll access. Using one subscription as a private “cinema feed”
        for a friend group is the wrong model: it puts all risk on the host and
        leaves guests without legitimate playback. Synced local streams keep
        everyone on the right side of normal account rules.
      </p>

      <h2
        id="better-path"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Better path: Discord voice + synced tabs
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        Keep Discord for banter. Replace Go Live with an AniDachi watchroom so
        each friend opens Crunchyroll locally. Full how-to:{" "}
        <Link
          href="/guides/how-to-watch-anime-together-without-screen-share"
          className="text-brand-orange hover:underline"
        >
          watch anime together without screen share
        </Link>
        . Migration checklist:{" "}
        <Link
          href="/guides/switch-from-discord-screen-share"
          className="text-brand-orange hover:underline"
        >
          switch from Discord screen share
        </Link>
        . Feature tradeoffs:{" "}
        <Link
          href="/compare/anidachi-vs-discord-screen-share"
          className="text-brand-orange hover:underline"
        >
          AniDachi vs Discord screen share
        </Link>
        .
      </p>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Hosts who need unlimited rooms and async catch-up can review{" "}
        <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
          AniDachi pricing
        </Link>
        .
      </p>

      <h2
        id="related"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Related guides
      </h2>
      <ul className="space-y-2 text-brand-orange mb-8">
        <li>
          <Link
            href="/guides/how-to-watch-anime-together-without-screen-share"
            className="hover:underline"
          >
            How to watch anime together without screen share
          </Link>
        </li>
        <li>
          <Link
            href="/guides/switch-from-discord-screen-share"
            className="hover:underline"
          >
            Switch from Discord screen share
          </Link>
        </li>
        <li>
          <Link
            href="/compare/anidachi-vs-discord-screen-share"
            className="hover:underline"
          >
            AniDachi vs Discord screen share
          </Link>
        </li>
        <li>
          <Link href="/pricing" className="hover:underline">
            AniDachi pricing
          </Link>
        </li>
        {relatedGuideLinks.map((guide) => (
          <li key={guide.href}>
            <Link href={guide.href} className="hover:underline">
              {guide.label}
            </Link>
          </li>
        ))}
      </ul>
    </SeoPageLayout>
  );
}
