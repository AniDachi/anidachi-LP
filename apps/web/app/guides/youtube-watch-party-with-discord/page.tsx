import type { Metadata } from "next";
import Link from "next/link";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_DISCORD_COMPARE_FAQ } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "YouTube Watch Party With Discord (2026 Hybrid Guide) | AniDachi",
  description:
    "Best setup: Discord for voice + AniDachi for YouTube sync — not Discord Go Live. How to watch YouTube together on Discord without crushed video quality.",
  alternates: {
    canonical: "/guides/youtube-watch-party-with-discord",
  },
  openGraph: {
    title: "YouTube Watch Party With Discord",
    description:
      "Voice on Discord, sync on AniDachi — the hybrid YouTube watch party workflow.",
    url: "/guides/youtube-watch-party-with-discord",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "YouTube Watch Party With Discord",
    description: "Discord voice + AniDachi YouTube sync (skip Go Live).",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "How do I watch YouTube together on Discord?",
    answer:
      "Use Discord for voice (or video call), and sync YouTube with AniDachi or Watch2Gether. Avoid Discord Go Live as the primary video path — friends get compressed quality and one person controls the stream.",
  },
  {
    question: "Can Discord sync YouTube playback natively?",
    answer:
      "No. Discord does not sync each person’s YouTube player. Screen share / Go Live only shows one person’s stream. Pair Discord voice with a real sync tool.",
  },
  {
    question: "Is AniDachi better than Discord screen share for YouTube?",
    answer:
      "Yes for video quality and per-user controls. Everyone watches YouTube locally while AniDachi keeps playback aligned; Discord handles the conversation.",
  },
  {
    question: "How does AniDachi pricing compare to Discord?",
    answer: PRICING_DISCORD_COMPARE_FAQ,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "hybrid", label: "Hybrid workflow", level: 2 },
  { id: "why-not-golive", label: "Why not Go Live", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Start a Discord voice channel",
    text: "Invite friends to a Discord voice (or video) channel for reactions.",
  },
  {
    name: "Open the same YouTube video",
    text: "Each person opens the full youtube.com/watch page in Chrome.",
  },
  {
    name: "Create an AniDachi watchroom",
    text: "Host creates a YouTube watchroom and shares the invite link in Discord chat.",
  },
  {
    name: "Watch with voice on Discord",
    text: "Playback stays synced in AniDachi while conversation stays in Discord.",
  },
];

export default function YoutubeWatchPartyWithDiscordPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["youtube", "watch-party"],
    excludeHref: "/guides/youtube-watch-party-with-discord",
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="How to run a YouTube watch party with Discord"
        description="Pair Discord voice with AniDachi YouTube sync instead of Go Live."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "YouTube Watch Party", url: "/watch-youtube-together" },
          {
            name: "YouTube watch party with Discord",
            url: "/guides/youtube-watch-party-with-discord",
          },
        ]}
        title="YouTube watch party with Discord"
        description="Discord voice + AniDachi YouTube sync — hybrid co-watch without Go Live."
        url="/guides/youtube-watch-party-with-discord"
        datePublished="2026-07-25"
        dateModified="2026-08-11"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          YouTube Watch Party With Discord
        </h1>

        <h2
          id="answer"
          className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
        >
          Short Answer
        </h2>
        <p className="text-xl text-foreground/80 leading-relaxed mb-8">
          <strong>
            Use Discord for voice and AniDachi for YouTube sync — not Discord Go
            Live as your video source.
          </strong>{" "}
          Full quality on each person’s YouTube tab, conversation in Discord.
          Start at{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            pricing / early access
          </Link>
          .
        </p>

        <h2
          id="hybrid"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Hybrid workflow
        </h2>
        <ol className="list-decimal pl-6 space-y-2 text-foreground/80 mb-8">
          {howToSteps.map((step) => (
            <li key={step.name}>
              <strong>{step.name}.</strong> {step.text}
            </li>
          ))}
        </ol>

        <PrimaryCheckoutCta
          pagePath="/guides/youtube-watch-party-with-discord"
          pageTemplate="guide"
          placement="content_mid"
          className="my-10"
        />

        <h2
          id="why-not-golive"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Why not Discord Go Live?
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Go Live compresses video, puts one person in control of pause/seek, and
          can conflict with streaming ToS expectations. Local YouTube + AniDachi
          sync keeps quality and controls with every viewer — same pattern as{" "}
          <Link
            href="/guides/crunchyroll-watch-party-with-discord"
            className="text-brand-orange hover:underline"
          >
            Crunchyroll + Discord
          </Link>
          .
        </p>

        <h2
          id="related"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Related
        </h2>
        <ul className="space-y-2 text-brand-orange">
          <li>
            <Link href="/watch-youtube-together" className="hover:underline">
              YouTube watch party hub
            </Link>
          </li>
          <li>
            <Link
              href="/guides/how-to-watch-youtube-with-friends"
              className="hover:underline"
            >
              How to watch YouTube with friends
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
          {relatedGuideLinks.map((g) => (
            <li key={g.href}>
              <Link href={g.href} className="hover:underline">
                {g.label}
              </Link>
            </li>
          ))}
        </ul>
      </SeoPageLayout>
    </>
  );
}
