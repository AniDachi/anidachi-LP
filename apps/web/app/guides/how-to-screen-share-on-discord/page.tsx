import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideNote,
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
    name: "Join a voice call",
    text: "Open a Discord voice channel or start a call with the people who will watch.",
  },
  {
    name: "Share your screen",
    text: "Choose Share Your Screen in the call controls, then pick the browser window with the video.",
  },
  {
    name: "Check what friends see",
    text: "Ask if the picture is sharp and in sync with your voice. A black window usually means the player blocked the capture.",
  },
  {
    name: "Switch Crunchyroll or YouTube to a watchroom",
    text: "For a full episode, stop the share. Each person opens the same Crunchyroll episode or YouTube video and joins an AniDachi watchroom. Leave Discord on for voice.",
  },
];

export const metadata: Metadata = {
  title: "How to Screen Share on Discord (and When to Stop)",
  description:
    "How to screen share on Discord: join a voice call, share the window, then switch Crunchyroll or YouTube to an AniDachi watchroom when the picture gets soft.",
  alternates: { canonical: "/guides/how-to-screen-share-on-discord" },
  openGraph: {
    title: "How to Screen Share on Discord",
    description: "The share steps, plus a clearer way to watch Crunchyroll or YouTube.",
    url: "/guides/how-to-screen-share-on-discord",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Screen Share on Discord",
    description: "Share a window, then move long watches off the share.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "How do I screen share on Discord?",
    answer:
      "Join a voice channel, click Share Your Screen, and choose the window. Friends watch your capture inside the call.",
  },
  {
    question: "Why does the shared video look bad?",
    answer:
      "Discord compresses the capture and can lag behind your voice. Some players also go black when captured. For Crunchyroll and YouTube, a synced watchroom keeps full quality on each person’s own tab.",
  },
  {
    question: "Can AniDachi replace a Netflix screen share?",
    answer:
      "No. AniDachi does not sync Netflix. It syncs Crunchyroll catalog pages and full YouTube watch pages in desktop Chrome.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "steps", label: "Steps", level: 2 },
  { id: "after", label: "After the share", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function HowToScreenShareOnDiscordPage() {
  return (
    <>
      <HowToJsonLd
        name="How to screen share on Discord"
        description="Share a Discord window, then move Crunchyroll or YouTube to a synced watchroom."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Discord watch party", url: "/discord-watch-party" },
          {
            name: "Screen share on Discord",
            url: "/guides/how-to-screen-share-on-discord",
          },
        ]}
        title="How to screen share on Discord"
        description="Discord screen share steps and when to use a watchroom instead."
        url="/guides/how-to-screen-share-on-discord"
        datePublished="2026-09-26"
        dateModified="2026-09-26"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImage}
        aboveFoldCta
      >
        <SeoGuideTitle>How to screen share on Discord</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            Join a Discord voice call, share the browser window, and confirm
            friends can see it. For a whole Crunchyroll episode or YouTube
            video, stop the share and use a{" "}
            <Link href="/discord-watch-party">Discord watch party</Link> with
            AniDachi so each person plays the video locally.
          </p>
        </SeoGuideAnswer>
        <h2 id="steps" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Steps
        </h2>
        <SeoGuideSteps steps={howToSteps} />
        <h2 id="after" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          After the share
        </h2>
        <SeoGuideNote>
          A black or blurry window is common on protected video. Install
          AniDachi from <Link href="/extension">/extension</Link>, open the same
          title, and keep Discord for talking. More on{" "}
          <Link href="/watch-crunchyroll-together">Crunchyroll</Link> and{" "}
          <Link href="/watch-youtube-together">YouTube</Link> watch parties.
        </SeoGuideNote>
        <SeoGuideRelated
          links={[
            { href: "/discord-watch-party", label: "Discord watch party" },
            {
              href: "/guides/can-you-screen-share-crunchyroll-on-discord",
              label: "Screen share Crunchyroll on Discord",
            },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
