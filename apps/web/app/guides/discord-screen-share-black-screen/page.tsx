import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { HowToJsonLd } from "@/components/json-ld";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { INSTALL_HOWTO_STEP_TEXT_VIA_HUB } from "@/lib/install-cta";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

const howToSteps = [
  {
    name: "Confirm you shared the video window",
    text: "A Discord screen share black screen is often the wrong surface: a second monitor, the desktop, or a window that is not the player. Share the Chrome window that has the video.",
  },
  {
    name: "Ask whether they hear audio",
    text: "Sound with a black picture means the share started and the player blocked the image. Silence and black means the share itself never showed the right window.",
  },
  {
    name: "Stop the share for a full episode",
    text: "Crunchyroll often blocks capture. YouTube can too. A long episode should not stay on that black window.",
  },
  {
    name: "Watch on each person’s own account",
    text: `${INSTALL_HOWTO_STEP_TEXT_VIA_HUB} Each person opens the same Crunchyroll episode or full youtube.com/watch page and joins one AniDachi room. Leave Discord on for voice.`,
  },
];

export const metadata: Metadata = {
  title: "Discord Screen Share Black Screen — What to Check",
  description:
    "A Discord screen share black screen usually means the wrong window or a player that blocks capture. Stop the share for a full Crunchyroll or YouTube episode and sync it with AniDachi.",
  alternates: { canonical: "/guides/discord-screen-share-black-screen" },
  openGraph: {
    title: "Discord Screen Share Black Screen",
    description: "Check the window, then move a long watch off the share.",
    url: "/guides/discord-screen-share-black-screen",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Discord Screen Share Black Screen",
    description: "Black picture, then a watch that does not need capture.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Why is Discord screen share a black screen?",
    answer:
      "You shared the wrong surface, or the video player blocked capture. Friends may still hear audio. Check the Chrome window first, then stop the share for a full episode.",
  },
  {
    question: "Why is Crunchyroll a black screen on Discord?",
    answer:
      "The Crunchyroll player often blocks capture. Keep Discord for voice. Each person opens the episode on their own account and joins an AniDachi watchroom.",
  },
  {
    question: "Can a YouTube share go black too?",
    answer:
      "Yes. Share the browser window with the full youtube.com/watch page. Shorts, embeds, and the YouTube mobile app are not the episode AniDachi syncs.",
  },
  {
    question: "Is a black screen the same as screen share not working?",
    answer:
      "No. Not working means the share never starts. A black screen means something was shared and the picture is empty.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "steps", label: "What to check", level: 2 },
  { id: "crunchyroll", label: "Crunchyroll", level: 2 },
  { id: "youtube", label: "YouTube", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function DiscordScreenShareBlackScreenPage() {
  return (
    <>
      <HowToJsonLd
        name="Fix a Discord screen share black screen"
        description="Check the shared window, then move a Crunchyroll or YouTube episode off the share."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Discord watch party", url: "/discord-watch-party" },
          {
            name: "Screen share black screen",
            url: "/guides/discord-screen-share-black-screen",
          },
        ]}
        title="Discord screen share black screen"
        description="A black Discord share, and the watch that does not depend on capture."
        url="/guides/discord-screen-share-black-screen"
        datePublished="2026-10-08"
        dateModified="2026-10-08"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImage}
        aboveFoldCta
      >
        <SeoGuideTitle>Discord screen share black screen</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            A Discord screen share black screen means friends see a dark window,
            sometimes with the audio still playing. Share the Chrome window that
            has the video. For a whole episode, stop the share and use a{" "}
            <Link href="/discord-watch-party">Discord watch party</Link> so each
            person plays Crunchyroll or YouTube on their own account.
          </p>
        </SeoGuideAnswer>
        <h2 id="steps" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          What to check
        </h2>
        <SeoGuideSteps steps={howToSteps} />
        <h2 id="crunchyroll" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Crunchyroll black screen on Discord
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          This is the common case. The player blocks capture, so the share
          stays black. The Crunchyroll-only writeup is{" "}
          <Link
            href="/guides/can-you-screen-share-crunchyroll-on-discord"
            className="text-brand-orange hover:underline"
          >
            can you screen share Crunchyroll on Discord
          </Link>
          . Streaming the episode through the call is{" "}
          <Link
            href="/guides/can-you-stream-crunchyroll-on-discord"
            className="text-brand-orange hover:underline"
          >
            can you stream Crunchyroll on Discord
          </Link>
          .
        </p>
        <h2 id="youtube" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          YouTube black screen on Discord
        </h2>
        <SeoGuideBulletList
          items={[
            {
              title: "Share the watch page",
              body: "The window has to be the full youtube.com/watch video, not a different monitor.",
            },
            {
              title: "Leave Shorts alone",
              body: "Shorts, embeds, and the YouTube mobile app are not the video AniDachi syncs.",
            },
            {
              title: "Then leave the share",
              body: "Install from /extension, open that same video, and keep Discord for voice.",
            },
          ]}
        />
        <p className="mb-6 leading-relaxed text-ani-muted">
          If the share button never appears, that is{" "}
          <Link
            href="/guides/discord-screen-share-not-working"
            className="text-brand-orange hover:underline"
          >
            Discord screen share not working
          </Link>
          . The general steps are{" "}
          <Link
            href="/guides/how-to-screen-share-on-discord"
            className="text-brand-orange hover:underline"
          >
            how to screen share on Discord
          </Link>
          . Netflix is coming soon and is not on the public extension yet.
        </p>
        <SeoGuideRelated
          links={[
            { href: "/discord-watch-party", label: "Discord watch party" },
            {
              href: "/guides/can-you-screen-share-crunchyroll-on-discord",
              label: "Screen share Crunchyroll on Discord",
            },
            { href: "/watch-youtube-together", label: "YouTube watch party" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
