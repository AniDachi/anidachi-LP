import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { HowToJsonLd } from "@/components/json-ld";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

const howToSteps = [
  {
    name: "Stay in the Discord call",
    text: "Use Discord for voice. Do not rely on it to carry the Crunchyroll picture for a full episode.",
  },
  {
    name: "Open the same episode",
    text: "Each person signs into their own Crunchyroll account in desktop Chrome and opens the same episode.",
  },
  {
    name: "Start an AniDachi watchroom",
    text: "Install from the AniDachi extension page, create a room, and share the link. Playback stays on each person’s player.",
  },
  {
    name: "Leave screen share for a short look",
    text: "If you only need to point at a menu, share the window. Stop the share before a long episode. A black window is common on the Crunchyroll player.",
  },
];

export const metadata: Metadata = {
  title: "Can You Stream Crunchyroll on Discord?",
  description:
    "You can watch Crunchyroll with a Discord call up. Streaming the player through screen share often goes black. Sync each person’s own tab with AniDachi.",
  alternates: { canonical: "/guides/can-you-stream-crunchyroll-on-discord" },
  openGraph: {
    title: "Can You Stream Crunchyroll on Discord?",
    description: "Keep Discord for voice. Play Crunchyroll on each account.",
    url: "/guides/can-you-stream-crunchyroll-on-discord",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Can You Stream Crunchyroll on Discord?",
    description: "The call can stay up. The player should stay local.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Can you stream Crunchyroll on Discord?",
    answer:
      "You can be in a Discord call while you watch Crunchyroll. Sending the Crunchyroll player through Discord screen share often shows a black window. Each person should open the episode on their own account and sync it with AniDachi.",
  },
  {
    question: "Does everyone need Crunchyroll?",
    answer:
      "Yes. AniDachi does not share one login or one video stream. Each viewer uses their own Crunchyroll access.",
  },
  {
    question: "What about YouTube in the same call?",
    answer:
      "The same pattern works for a full YouTube watch page. Shorts, embeds, and the YouTube mobile app are not supported. Netflix is not supported.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "why", label: "Why the share fails", level: 2 },
  { id: "how", label: "Watch on a Discord call", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function CanYouStreamCrunchyrollOnDiscordPage() {
  return (
    <>
      <HowToJsonLd
        name="How to watch Crunchyroll on a Discord call"
        description="Keep Discord for voice and sync Crunchyroll on each person’s own account."
        steps={howToSteps}
      />
      <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Discord watch party", url: "/discord-watch-party" },
        {
          name: "Stream Crunchyroll on Discord",
          url: "/guides/can-you-stream-crunchyroll-on-discord",
        },
      ]}
      title="Can you stream Crunchyroll on Discord?"
      description="Watch Crunchyroll during a Discord call without a compressed share."
      url="/guides/can-you-stream-crunchyroll-on-discord"
      datePublished="2026-09-27"
      dateModified="2026-09-27"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Can you stream Crunchyroll on Discord?</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          You can watch Crunchyroll while a Discord call stays up. Streaming
          the Crunchyroll window through Discord is the fragile part. Use the
          call for voice, and sync the episode with a{" "}
          <Link href="/discord-watch-party">Discord watch party</Link> so each
          person plays it on their own account.
        </p>
      </SeoGuideAnswer>
      <h2 id="why" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Why a Crunchyroll share goes black
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        The player often blocks capture, so friends see a black or soft
        picture and hear the video late. The share steps, including that
        failure, are on{" "}
        <Link
          href="/guides/how-to-screen-share-on-discord"
          className="text-brand-orange hover:underline"
        >
          how to screen share on Discord
        </Link>{" "}
        and{" "}
        <Link
          href="/guides/can-you-screen-share-crunchyroll-on-discord"
          className="text-brand-orange hover:underline"
        >
          can you screen share Crunchyroll on Discord
        </Link>
        . Those pages are for the share itself. This page is the way to keep
        the call and still watch the episode.
      </p>
      <h2 id="how" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        How to watch Crunchyroll on a Discord call
      </h2>
      <SeoGuideSteps steps={howToSteps} />
      <p className="mb-6 leading-relaxed text-ani-muted">
        Install from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          /extension
        </Link>
        . If the night is YouTube instead, use{" "}
        <Link
          href="/guides/discord-watch-together"
          className="text-brand-orange hover:underline"
        >
          Discord watch together
        </Link>
        . AniDachi does not sync Netflix.
      </p>
      <SeoGuideRelated
        links={[
          { href: "/discord-watch-party", label: "Discord watch party" },
          {
            href: "/guides/crunchyroll-watch-party-with-discord",
            label: "Crunchyroll watch party with Discord",
          },
          {
            href: "/watch-crunchyroll-together",
            label: "Crunchyroll watch party",
          },
        ]}
      />
    </SeoPageLayout>
    </>
  );
}
