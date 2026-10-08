import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideRelated,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

export const metadata: Metadata = {
  title: "Discord Screen Share Black Screen — What to Check",
  description:
    "A Discord screen share black screen usually means the player blocked capture or you shared the wrong window. For a full episode, leave Discord on voice and sync Crunchyroll or YouTube with AniDachi.",
  alternates: { canonical: "/guides/discord-screen-share-black-screen" },
  openGraph: {
    title: "Discord Screen Share Black Screen",
    description: "A black window on a share, and when to stop sharing.",
    url: "/guides/discord-screen-share-black-screen",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Discord Screen Share Black Screen",
    description: "Check the window, then move a long watch off the share.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Why is my Discord screen share a black screen?",
    answer:
      "Discord is often sharing the wrong surface, or the video player is blocking capture. Friends may still hear audio. A whole Crunchyroll episode or YouTube video should not stay on that share.",
  },
  {
    question: "Why is Crunchyroll a black screen on Discord?",
    answer:
      "The Crunchyroll player often blocks capture. The working watch is each person on their own account, with Discord left on for voice. The screen-share page for Crunchyroll covers that case.",
  },
  {
    question: "Can YouTube also go black on a Discord share?",
    answer:
      "Yes. Share the browser window that has the full youtube.com/watch page, not a different monitor. Shorts, embeds, and the YouTube mobile app are not the watch AniDachi supports.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "check", label: "What to check", level: 2 },
  { id: "crunchyroll", label: "Crunchyroll black screen", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function DiscordScreenShareBlackScreenPage() {
  return (
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
          sometimes with audio still playing. Check that you shared the video
          window. For a full episode, stop the share and use a{" "}
          <Link href="/discord-watch-party">Discord watch party</Link> so each
          person plays Crunchyroll or YouTube locally.
        </p>
      </SeoGuideAnswer>
      <h2 id="check" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        What to check first
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "The surface you shared",
            body: "A whole screen, a different monitor, or a blank window shows black. Share the browser window that has the video.",
          },
          {
            title: "The player",
            body: "Some players block capture. You hear the show and see black. That is the player, not a missing Discord button.",
          },
          {
            title: "A long episode",
            body: "Even a share that works is soft and late. Leave Discord for voice once the episode starts.",
          },
        ]}
      />
      <h2 id="crunchyroll" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Crunchyroll black screen on Discord
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Crunchyroll is the common case. The steps and the blocked capture are
        on{" "}
        <Link
          href="/guides/can-you-screen-share-crunchyroll-on-discord"
          className="text-brand-orange hover:underline"
        >
          can you screen share Crunchyroll on Discord
        </Link>
        . If the share button itself is missing, use{" "}
        <Link
          href="/guides/discord-screen-share-not-working"
          className="text-brand-orange hover:underline"
        >
          Discord screen share not working
        </Link>
        . The share steps are on{" "}
        <Link
          href="/guides/how-to-screen-share-on-discord"
          className="text-brand-orange hover:underline"
        >
          how to screen share on Discord
        </Link>
        . Install AniDachi from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          /extension
        </Link>
        . Netflix is coming soon and is not supported yet.
      </p>
      <SeoGuideRelated
        links={[
          { href: "/discord-watch-party", label: "Discord watch party" },
          {
            href: "/guides/can-you-screen-share-crunchyroll-on-discord",
            label: "Screen share Crunchyroll on Discord",
          },
          {
            href: "/guides/discord-screen-share-not-working",
            label: "Discord screen share not working",
          },
        ]}
      />
    </SeoPageLayout>
  );
}
